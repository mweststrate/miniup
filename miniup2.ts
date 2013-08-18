module miniup {

	export interface NamedRule {
		ruleName?: string;
		friendlyName?: string;
		astName?: string;
	}

	export interface ParseFunction extends NamedRule {
		memoizationId?: number;
		isKeywordMatcher?: bool;

		(parser: Parser): any;
	}

	export class MatcherFactory {

		//TODO: any (.) matcher
		//TODO: $ matcher (what does it mean?) ->Try to match the expression. If the match succeeds, return the matched string instead of the match result.
		//TODO: import matcher (requires global registry)
		//TODO: operator matcher (operand operator)<   (or >)
		//TODO: non lazy or matcher?

		public static regex(regex: RegExp, ignoreCase: bool = false, autoWhitespace: bool = true): ParseFunction {
			//TODO: avoid whitespace matcher to auto match whitespace!
			var r = new RegExp("\\A" + regex.source, ignoreCase ? "i" : "");

			return (parser: Parser): any => {
				var remainingInput = parser.getRemainingInput();
				if (autoWhitespace)
					parser.consumeWhitespace();

				var match = remainingInput.match(r);
				if (match) {
					if (autoWhitespace) //TODO: nowhere post whitespace matching?
						parser.consumeWhitespace();

					parser.currentPos += match[0].length;
					return match[0];
					//TODO: return complex object with raw and unquoted values?
				}
				return undefined;
			}
		}

		public static characterClass(regexstr: string, ignoreCase: bool = false): ParseFunction {
			return regex(new RegExp(regexstr), ignoreCase, false);
		}

		public static literal(keyword: string, ignoreCase: bool = false): ParseFunction {
			return Util.extend(
				regex(new RegExp("\\A" + RegExpUtil.quoteRegExp(keyword)), ignoreCase, true),
				{ isKeywordMatcher: true }
			);
		}

		public static rule(ruleName: string): ParseFunction {
			return (parser: Parser): any => {
				return Util.extend(parser.parse(parser.grammar.rule(ruleName)), { ruleName: ruleName });
				//TODO: automatically set rulename property?
			}
		}

		public static zeroOrMore(matcher: ParseFunction): ParseFunction {
			return (parser: Parser): any => {
				var res = [];
				var item;
				do {
					item = parser.parse(matcher);
					if (item !== undefined)
						res.push(item);
				} while (item !== undefined);

				return res;
			}
		}

		public static oneOrMore(matcher: ParseFunction): ParseFunction {
			var zmm = zeroOrMore(matcher);

			return (parser: Parser): any => {
				var res = parser.parse(zmm);
				return res.length > 0 ? res : undefined;
			}
		}

		public static optional(matcher: ParseFunction): ParseFunction {
			return (parser: Parser): any => {
				var res = parser.parse(matcher);
				return res === undefined ? null : res;
			}
		}

		public static sequence(...items: ParseFunction[]): ParseFunction {
			if (items.length == 1 && !items[0].ruleName) //Not top level, and not a real sequence
				return items[0];

			return (parser: Parser): any => {
				var result = []; //TODO: should be object

				var success = items.every(item => {
					var itemres = parser.parse(item);
					if (itemres === undefined)
						return false;

					if (item.isKeywordMatcher && !item.friendlyName && items.length > 1)
						return true; //ignore result if it is just a stringmathcer without astname. Keywords are not interesting in an AST
					//TODO: ignore result if its a lookAhead

					result.push(itemres);
					if (item.astName)
						result[item.astName] = itemres;

					return true;
				});

				return success ? result.length == 1 ? result[0] : result : undefined;
			}
		}

		public static choice(choices: ParseFunction[]): ParseFunction {
			return (parser: Parser): any => {
				var res;

				if (choices.some(choice => undefined !== (res = parser.parse(choice))))
					return res;
				return undefined;
			}
		}

		public static positiveLookAhead(predicate: ParseFunction): ParseFunction {
			return (parser: Parser): any => {
				var prepos = parser.currentPos;
				//TODO: do *not* update best match while parsing predicates!
				var matches = undefined !== parser.parse(predicate);
				parser.currentPos = prepos;//rewind
				return matches ? null : undefined;
			}
		}

		public static negativeLookAhead(predicate: ParseFunction): ParseFunction {
			var ppm = positiveLookAhead(predicate);
			return (parser: Parser): any => {
				return parser.parse(ppm) === undefined ? null : undefined; //undefined == no match. null == match, so invert.
			}
		}

		public static named(name: string, matcher: ParseFunction) {
			return Util.extend(matcher, <NamedRule> { ruleName: name });
		}

		public static labeled(label: string, matcher: ParseFunction) {
			return Util.extend(matcher, <NamedRule> { astName: name });
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
		maxPos: number = -1;
		memoizedParseFunctions = {};
		private stack: StackItem[] = []; //TODO: is stack required anywhere?

		constructor(public grammar: Grammar, public input: String) {

		}

		public getRemainingInput(): string {
			return this.input.substring(this.currentPos);
		}

		parseInput(func: ParseFunction) : any {
			var res = this.parse(func);
			if (res === undefined)
				throw new ParseException();
			else {
				this.consumeWhitespace();
				if (this.currentPos < this.maxPos) //we parsed something valid, but not the whole input
					throw new ParseException();
				else if (this.currentPos < this.input.length)
					throw new ParseException();
			}
		}

		parse(func: ParseFunction): any {
			try {
				this.stack.push({
					func: func,
					startPos: this.currentPos
				});

				//TODO: get memoize record. If state is 'running', bail out: left recursion

				//TODO: left recursion support = do not if the rule is running, but has alternatives left!
				//rules that have alternatives on recursion should catch recursion exception and move on
				//to the next state? (n.b. make sure that this parse method handles stack unwind properly in a finally block)

				//if state is 'known' return memoized result
				//if state is 'new' continue, set state to 'running'

				if (this.isMemoized(func))
					return this.consumeMemoized(func);

				var startpos = this.currentPos;

				//TODO: if (startpos > bestPos && (func.isKeywordMatcher || func.friendlyName)) storeExpected;

				var result = func(this);

				if (!result)
					this.currentPos = startpos; //reset


				this.memoizedParseFunctions[func.memoizationId][startpos] = <MemoizeResult> {
					result: result,
					endPos: this.currentPos
				};

				return result;
			}
			finally {
				this.stack.pop(); //todo: process empty stack and such
			}
		}

		getCoords(idx: number): { line: number; col: number; linetext: string; linetrimmed: string; linehighlight: string;} {
			//TODO
			return null;
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

		consumeWhitespace(): bool {
			if (this.grammar.whitespaceMatcher)
				return undefined !== this.parse(this.grammar.whitespaceMatcher);
			return false;
		}
	}

	export class ParseException {
		//TODO: exception can contain detail results by looking into the last entry of the memoization cache and find all keywords / 'friendly names' / regexes
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
			  identifier = f.regex(RegExpUtil.identifier),
			  singleQuoteString = f.regex(RegExpUtil.singleQuoteString),
			  doubleQuoteString = f.regex(RegExpUtil.doubleQuoteString),
			  singlelinecomment = f.regex(RegExpUtil.singleLineComment),
			  multilinecomment = f.regex(RegExpUtil.multiLineComment),
			  whitespacechar = f.regex(RegExpUtil.whitespace),
			  regexp = f.regex(RegExpUtil.regex),
			  characterClass = f.regex(RegExpUtil.characterClass);

			//rules
			var seq = f.sequence, label = label, opt = f.optional;

			g.addRule('grammar', label('rules', f.oneOrMore(rule)));

			var str = g.addRule('string', choice(singleQuoteString, doubleQuoteString));
			var literal = g.addRule('literal', seq(str, opt(f.literal("i"))));
			g.addRule('whitespace', choice(whitespacechar, multilinecomment, singlelinecomment));

			var rule = g.addRule('rule', seq(label('name', identifier), label('displayName', opt(str)), equals, label('expression', expression), opt(semicolon)));

			var expression = g.addRule('expression', choice);

			var choice = g.addRule('choice', seq(
				label('head', sequence), label('tail', f.zeroOrMore(seq(slash, sequence)))));

			var sequence = g.addRule('sequence',
				label('elements', f.zeroOrMore(labeled)));

			var labeled = g.addRule('labeled',
			  choice(seq(label('label', identifier), colon, label('expression', prefixed)), prefixed));

			var prefixed = g.addRule('prefixed', choice(
			  seq(dollar, label('expression', suffixed)),
			  seq(and, label('expression', suffixed)),
			  seq(not, label('expression', suffixed)),
			  suffixed));

			var suffixed = g.addRule('suffixed', choice(
			  seq(label('expression', primary), question),
			  seq(label('expression', primary), star),
			  seq(label('expression', primary), plus),
			  primary));

			var primary = g.addRule('primary', choice(
			  seq(label('name', identifier), f.negativeLookAhead(seq(opt(str), equals)),
			  literal,
		      characterClass,
		      dot,
		      regexp,
		      seq(lparen, label('expression', expression), rparen))));

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

		public static quoteRegExp(str: string): string {
			return (str + '').replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
		}
	}

	export class Util {

		public static format(str: string, ...args: any[]) {
			return str.replace(/{(\d+)}/g, (match, nr) => args[nr]);
		}

		public static extend(thing: any, extendWith: Object): any {
			for (var key in extendWith)
				thing[key] = extendWith[key];
			return thing;
		}
	}


}