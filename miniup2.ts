module miniup {

	export class ParseFunction {
		ruleName : string;
		label : string;
		friendlyName : string;
		memoizationId: number;
		isKeyword = false;
		isCharacterClass = false;
		isTerminal = false;

		constructor(private asString: string, public parse : (parser: Parser) => any, opts? : Object) {
			if (opts)
				Util.extend(this, opts);
		}

		public toString(): string {
			return this.ruleName ? this.ruleName : (this.label ? this.label + ":" : "") + this.asString;
		}
	}

	export class MatcherFactory {

		//TODO: any char (.) matcher
		//TODO: $ matcher (what does it mean?) ->Try to match the expression. If the match succeeds, return the matched string instead of the match result.
		//TODO: import matcher (requires global registry)
		//TODO: operator matcher (operand operator)<   (or >)
		//TODO: non lazy or matcher?

		public static regex(regex: RegExp, ignoreCase: bool = false): ParseFunction { //TODO: probably first arg should be regex
			var r = new RegExp("^" + regex.source, ignoreCase ? "i" : "");

			return new ParseFunction("/" + regex.source + "/" /*TODO: quote? */, (parser: Parser): any => {
				var match = parser.getRemainingInput().match(r);
				if (match) {
					parser.currentPos += match[0].length;
					return match[0];
					//TODO: return complex object with raw and unquoted values?
				}
				return undefined;
			}, { isTerminal: true })
		}

		public static characterClass(regexstr: string, ignoreCase: bool = false): ParseFunction {
			var re = regex(new RegExp(regexstr), ignoreCase);
			return new ParseFunction(regexstr /*TODO: quote?*/, (p) => p.parse(re), { isCharacterClass: true, isTerminal: true });
		}

		public static literal(keyword: string, ignoreCase: bool = false): ParseFunction {
			var re = regex(new RegExp(RegExpUtil.quoteRegExp(keyword)), ignoreCase);
			return new ParseFunction("'" + keyword + "'", (p) => p.parse(re), { isKeyword: true, isTerminal: true });
		}

		public static dot(): ParseFunction {
			var re = regex(/^./, false);
			return new ParseFunction(".", (p) => p.parse(re), { isCharacterClass: true, isTerminal: true });
		}

		public static rule(ruleName: string): ParseFunction {
			return new ParseFunction(ruleName, p => p.parse(p.grammar.rule(ruleName)));
		}

		public static zeroOrMore(matcher: ParseFunction): ParseFunction {
			return new ParseFunction(matcher.toString() + "*", (parser: Parser): any => {
				var res = [];
				var item;
				do {
					item = parser.parse(matcher);
					if (item !== undefined)
						res.push(item);
				} while (item !== undefined);

				return res;
			});
		}

		public static oneOrMore(matcher: ParseFunction): ParseFunction {
			var zmm = zeroOrMore(matcher);

			return new ParseFunction(matcher.toString() + "+", (parser: Parser): any => {
				var res = parser.parse(zmm);
				return res.length > 0 ? res : undefined;
			});
		}

		public static optional(matcher: ParseFunction): ParseFunction {
			return new ParseFunction(matcher.toString() + "?", (parser: Parser): any => {
				var res = parser.parse(matcher);
				return res === undefined ? null : res;
			});
		}

		public static sequence(...items: ParseFunction[]): ParseFunction {
			if (items.length == 1 && !items[0].ruleName) //Not top level, and not a real sequence
				return items[0];

			return new ParseFunction(
				"(" + items.map(i => i.toString()).join(" ") + ")",
				(parser: Parser): any => {
					var result = []; //TODO: should be object

					var success = items.every(item => {
						var itemres = parser.parse(item);
						if (itemres === undefined)
							return false;

						if (item.isKeyword && !item.friendlyName && items.length > 1)
							return true; //ignore result if it is just a stringmathcer without label. Keywords are not interesting in an AST
						//TODO: ignore result if its a lookAhead

						result.push(itemres);
						if (item.label)
							result[item.label] = itemres;

						return true;
					});

					return success ? result.length == 1 ? result[0] : result : undefined;
				});
		}

		public static choice(...choices: ParseFunction[]): ParseFunction {
			return new ParseFunction(
				"(" + choices.map(x => x.toString()).join(" | ") + ")",
				(parser: Parser): any => {
					var res;

					if (choices.some(choice => undefined !== (res = parser.parse(choice))))
						return res;
					return undefined;
				});
		}

		public static positiveLookAhead(predicate: ParseFunction): ParseFunction {
			return new ParseFunction("&" + predicate.toString(), (parser: Parser): any => {
				var prepos = parser.currentPos;
				//TODO: do *not* update best match while parsing predicates!
				var matches = undefined !== parser.parse(predicate);
				parser.currentPos = prepos;//rewind
				return matches ? null : undefined;
			});
		}

		public static negativeLookAhead(predicate: ParseFunction): ParseFunction {
			var ppm = positiveLookAhead(predicate);
			return new ParseFunction("!" + predicate.toString(), (parser: Parser): any => {
				return parser.parse(ppm) === undefined ? null : undefined; //undefined == no match. null == match, so invert.
			});
		}

		public static named(name: string, matcher: ParseFunction) {
			matcher.ruleName = name;
			return matcher;
		}

		public static labeled(label: string, matcher: ParseFunction) {
			matcher.label = label;
			return matcher;
		}
	}

	export class Grammar {

		private rules = {};
		whitespaceMatcher: ParseFunction;
		public startSymbol: string;

		//TODO: add Grammar registery for import statements

		public static load(grammarSource: string): Grammar {
			//TODO:
			var ast = GrammarReader.bootstrap().parse(grammarSource);
			//TODO: auto load built in tokens?
			return GrammarReader.buildGrammar(ast);
		}

		public static loadFromFile(filename: string): Grammar {
			//TODO:
			return null;
		}

		public static loadFromXHR(filename: string, jQuery: any, callback:(grammar:Grammar) => void) {
			//TODO:
		}

		public test(input: string, expected: any) : Grammar {
			//TODO:
			return this;
		}

		addRule(rule: ParseFunction): ParseFunction;
		addRule(name: string, rule: ParseFunction, replace: bool = false): ParseFunction;
		addRule(arg1: any, arg2?: ParseFunction, replace: bool = false) : ParseFunction {
			var rule: ParseFunction = arg2 ? MatcherFactory.named(arg1, arg2) : arg1;
			if (!rule.ruleName)
				throw new Error("Anonymous rules cannot be registered in a grammar. ");
			if (!replace && this.rules[rule.ruleName])
				throw new Error("Rule '" + rule.ruleName + "' is already defined");
			if ("whitespace" == rule.ruleName)
				this.whitespaceMatcher = rule;
			if (this.startSymbol == null)
				this.startSymbol = rule.ruleName;

			this.rules[rule.ruleName] = rule;
			return rule;
		}

		public rule(ruleName: string): ParseFunction {
			if (!this.rules[ruleName])
				throw new Error("Rule '" + ruleName + "' is not defined");
			return this.rules[ruleName];
		}

		public parse(input: string, opts: { startSymbol?: string; inputName?: string; debug?: bool; } = {}): any {
			//TODO: store inputName and show in exceptions
			//TODO: use 'debug' for logging
			return new Parser(this, input).parseInput(this.rule(opts.startSymbol || this.startSymbol));
		}

	}

	export interface StackItem {
		func: ParseFunction;
		startPos: number;
	}

	interface MemoizeResult {
		result: any;
		endPos: number;
	}

	export class Parser {

		private static nextMemoizationId = 1;

		currentPos: number = 0;
		memoizedParseFunctions = {};
		inputName: string; //TODO: filename and such
		public debug = true; //TODO: false
		private previousIsCharacterClass = false;
		private parsingWhitespace = false; //TODO: rename to 'isParsingWhitespace'
		private stack: StackItem[] = []; //TODO: is stack required anywhere?
		expected = [];

		constructor(public grammar: Grammar, public input: string) {
			//empty
		}

		public getRemainingInput(): string {
			return this.input.substring(this.currentPos);
		}

		parseInput(func: ParseFunction) : any {
			var res = this.parse(func);
			if (res === undefined) {
				if (this.expected.length >= this.input.length)
					throw new ParseException(this, "Unexpected end of input. ");
				throw new ParseException(this, "Failed to parse");
			}
			else {
				if (this.currentPos < this.expected.length -1) //we parsed something valid, but not the whole input
					throw new ParseException(this, "Found superflous input after parsing");
				return res;
			}
		}

		parse(func: ParseFunction): any {
			var startpos = this.currentPos,
				isMatch = false,
				result = undefined;

			try {
				//consume whitespace
				if (!this.parsingWhitespace && (!func.isCharacterClass || this.previousIsCharacterClass))
					this.consumeWhitespace(); //whitespace was not consumed yet, do it now

				this.stack.push({ func: func, startPos : this.currentPos}); //Note, not startpos.

				//check memoization cache
				if (this.isMemoized(func)) {
					if (this.debug && !this.parsingWhitespace)
						Util.debug(Util.leftPad(" /" + func.toString() + " ? (memo)", this.stack.length, " |"));

					result = this.consumeMemoized(func);
				}

				else {
					if (this.debug && !this.parsingWhitespace)
						Util.debug(Util.leftPad(" /" + func.toString() + " ?", this.stack.length, " |"));

					//store expected
					if (func.isTerminal && !this.parsingWhitespace) {
						if (!this.expected[this.currentPos])
							this.expected[this.currentPos] = [];
						this.expected[this.currentPos].push(func.friendlyName || func.ruleName || func.toString());
					}

					//finally... parse!
					result = func.parse(this);

					//enrich result with match information
					if (result !== null && result !== undefined)
						Util.extend(result, { parsePos : startpos, ruleName : func.ruleName }); //TODO; only if object?

					//store memoization result
					this.memoizedParseFunctions[func.memoizationId][startpos] = <MemoizeResult> {
						result: result,
						endPos: this.currentPos
					};
				}

				return result;
			}
			finally {
				isMatch = result !== undefined;

				if (isMatch) {
					if (!this.parsingWhitespace && !func.isCharacterClass)
						this.consumeWhitespace();
					this.previousIsCharacterClass = func.isCharacterClass;
				}

				else 
					this.currentPos = startpos; //rewind

				if (this.debug && !this.parsingWhitespace)
					Util.debug(Util.leftPad(" \\" + func.toString() + (isMatch ? " V" : " X"), this.stack.length, " |") + " Remaining: " + this.getRemainingInput());

				this.stack.pop();
			}
		}

		isMemoized(func: ParseFunction): bool {
			if (!func.memoizationId)
				func.memoizationId = Parser.nextMemoizationId++;

			if (!this.memoizedParseFunctions[func.memoizationId]) {
				this.memoizedParseFunctions[func.memoizationId] = {};
				return false;
			}
			return this.memoizedParseFunctions[func.memoizationId][this.currentPos] !== undefined;
		}

		consumeMemoized(func: ParseFunction): any {
			var m: MemoizeResult = this.memoizedParseFunctions[func.memoizationId][this.currentPos];
			this.currentPos = m.endPos;
			return m.result;
		}

		consumeWhitespace() {
			if (this.grammar.whitespaceMatcher) {
				this.parsingWhitespace = true;
				this.parse(this.grammar.whitespaceMatcher);
				this.parsingWhitespace = false;
			}
		}
	}

	export class ParseException {
		public name = "Miniup.ParseException";
		public message : string;
		public coords: TextCoords;

		constructor(parser: Parser, message: string, highlightBestMatch : bool = true) {
			var pos = highlightBestMatch ? parser.expected.length -1 : parser.currentPos;
			this.coords = Util.getCoords(parser.input, pos);

			this.message = Util.format("{0} at {1} line {2}:{3}\n\n{4}\n{5}\nExpected: {6}",
				message, parser.inputName, this.coords.line, this.coords.col,
				this.coords.linetrimmed,
				this.coords.linehighlight,
				parser.expected[pos].join(" or ")
			);
		}

		public toString():string { return this.name + ": " + this.message }
	}

	export class GrammarReader {
		private static miniupGrammar: Grammar = null;

		public static getMiniupGrammar(): Grammar {
			if (miniupGrammar == null)
				miniupGrammar = bootstrap();
			return miniupGrammar;
		}

		private static bootstrap(): Grammar {
			//Based on https://github.com/dmajda/pegjs/blob/master/src/parser.pegjs

			var g = new Grammar(), f = MatcherFactory;

			//literals
			var
			  equals = f.literal("="),
			  colon = f.literal(":"),
			  semicolon = f.literal(";"),
			  slash = f.literal("/"),
			  and = f.literal("&"),
			  not = f.literal("!"),
			  dollar = f.literal("$"),
			  question = f.literal("?"),
			  star = f.literal("*"),
			  plus = f.literal("+"),
			  lparen = f.literal("("),
			  rparen = f.literal(")"),
			  dot = f.literal(".");

			var
			  identifier = f.named('Identifier', f.regex(RegExpUtil.identifier)), //TODO: automated construct these rules
			  singleQuoteString = f.named('SingleQuoteString', f.regex(RegExpUtil.singleQuoteString)),
			  doubleQuoteString = f.named('DoubleQuoteString', f.regex(RegExpUtil.doubleQuoteString)),
			  singlelinecomment = f.named('Comment', f.regex(RegExpUtil.singleLineComment)),
			  multilinecomment = f.named('MultiLineComment', f.regex(RegExpUtil.multiLineComment)),
			  whitespacechar = f.named('WhiteSpace', f.regex(RegExpUtil.whitespace)),
			  regexp = f.named('Regex', f.regex(RegExpUtil.regex)),
			  characterClass = f.named('CharacterClass', f.regex(RegExpUtil.characterClass));

			//rules
			var seq = f.sequence, label = f.labeled, opt = f.optional, choice = f.choice;

			var str = g.addRule('string', choice(singleQuoteString, doubleQuoteString));
			var literal = g.addRule('literal', seq(str, opt(f.literal("i"))));
			g.addRule('whitespace', choice(whitespacechar, multilinecomment, singlelinecomment));

			var primary = g.addRule('primary', choice(
			  seq(label('name', identifier), f.negativeLookAhead(seq(opt(str), equals))),
			  literal,
		      characterClass,
		      dot,
		      regexp,
		      seq(lparen, label('expression', f.rule('expression')), rparen)));

			var suffixed = g.addRule('suffixed', choice(
			  seq(label('expression', primary), question),
			  seq(label('expression', primary), star),
			  seq(label('expression', primary), plus),
			  primary));

			var prefixed = g.addRule('prefixed', choice(
			  seq(dollar, label('expression', suffixed)),
			  seq(and, label('expression', suffixed)),
			  seq(not, label('expression', suffixed)),
			  suffixed));

			var labeled = g.addRule('labeled',
			  choice(seq(label('label', identifier), colon, label('expression', prefixed)), prefixed));

			var sequence = g.addRule('sequence',
				label('elements', f.zeroOrMore(labeled)));

			var choicerule = g.addRule('choice', seq(
				label('head', sequence), label('tail', f.zeroOrMore(seq(slash, sequence)))));

			var expression = g.addRule('expression', choicerule);

			var rule = g.addRule('rule', seq(label('name', identifier), label('displayName', opt(str)), equals, label('expression', expression), opt(semicolon)));
			g.addRule('grammar', label('rules', f.oneOrMore(rule)));

			g.startSymbol = "grammar";
			return g;
		}

		public static buildGrammar(ast: any): Grammar {
			var g = new Grammar();
			(<any[]>ast.rules).map(this.astToMatcher, this).forEach(g.addRule, g);
			return g;
		}

		static astToMatcher(ast: any) : ParseFunction {
			//TODO:
			return null;
		}
	}

	export class RegExpUtil {
	/*	from miniup java:
		public static IDENTIFIER = new BuiltinToken("IDENTIFIER", "[a-zA-Z_][a-zA-Z_0-9]*", false);
		public static WHITESPACE = new BuiltinToken("WHITESPACE", "\\s+", true);
		public static INTEGER = new BuiltinToken("INTEGER", "-?\\d+", false);
		public static FLOAT = new BuiltinToken("FLOAT", "-?\\d+(\\.\\d+)?(e\\d+)?", false);
		public static SINGLEQUOTEDSTRING = new BuiltinToken("SINGLEQUOTEDSTRING", "'(?>[^\\\\']|(\\\\[btnfr\"'\\\\]))*'", false);
		public static DOUBLEQUOTEDSTRING = new BuiltinToken("DOUBLEQUOTEDSTRING", "\"(?>[^\\\\\"]|(\\\\[btnfr\"'\\\\]))*\"", false);
		public static SINGLELINECOMMENT = new BuiltinToken("SINGLELINECOMMENT", "//[^\\n]*(\\n|$)", true);
	*///	public static MULTILINECOMMENT = new BuiltinToken("MULTILINECOMMENT", "/\\*(?:.|[\\n\\r])*?\\*/", true);
	//	public static bool = new BuiltinToken("bool", "true|false", false);
	//	public static REGULAREXPRESSION = new BuiltinToken("REGULAREXPRESSION", "/(?>[^\\\\/]|(\\\\.))*/", false);

		public static identifier = /[a-zA-Z_][a-zA-Z_0-9]*/;
		public static whitespace = /\s+/;
		public static regex = /\/([^\\\/]|(\\.))*\//;
		public static singleQuoteString = /'([^'\\]|(\\[btnfr"'\\]))*'/;
		public static doubleQuoteString = /"([^"\\]|(\\[btnfr"'\\]))*"/;
		public static singleLineComment = /\/\/[^\\n]*(\\n|$)/;
		public static multiLineComment = /\/\*(?:.|[\\n\\r])*?\*\//;
		public static characterClass = /\[([^\\\/]|(\\.))*\]/;
		public static integer = /-?\d+/;
		public static float = /-?\d+(\.\d+)?(e\d+)?/;
		public static boolRegexp = /(true|false)/;
		public static lineend = /(\r\n)|\r|\n/;

		public static quoteRegExp(str: string): string {
			return (str + '').replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
		}
	}

	export interface TextCoords {
		line: number;
		col: number;
		linetext: string;
		linetrimmed: string;
		linehighlight: string;
	}

	export class Util {

		public static format(str: string, ...args: any[]) {
			return str.replace(/{(\d+)}/g, (match, nr) => "" + args[nr]);
		}

		public static extend(thing: any, extendWith: Object): any {
			for (var key in extendWith)
				thing[key] = extendWith[key];
			return thing;
		}

		public static getCoords(input: string, pos: number): TextCoords {
			var lines = input.substring(0, pos).split(RegExpUtil.lineend);
			var curline = input.split(RegExpUtil.lineend)[lines.length -1];
			lines.pop(); //remove curline
			var col = pos - lines.join().length + 1;

			return {
				line : lines.length,
				col : col,
				linetext : curline,
				linetrimmed: curline.replace(/(^\s+|\s+$)/,"").replace(/\t/," "), //trim and replace tabs
				linehighlight : Util.leftPad("^", col - (curline.length - curline.replace(/^\s+/,"").length) - 2 , "-") //correct padding for trimmed whitespacse
			}
		}

		public static leftPad(str: string, amount: number, padString: string = " ") {
			for (var i = 0, r = ""; i < amount; i++, r += padString);
			return r + str;
		}

		public static debug(msg: string, ...args: string[]) {
			console && console.log(format.apply(null, [msg].concat(args)));
		}

	}


}