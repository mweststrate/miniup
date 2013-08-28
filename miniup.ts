// Some global environment stuff we use..
declare var exports : any;
declare var module: any;
declare var require: any;
declare var process : any;

module miniup {

	export class ParseFunction {
		ruleName : string;
		label : string;
		friendlyName : string;
		memoizationId: number;
		isKeyword = false; //TODO: isliteral
		isCharacterClass = false;
		isTerminal = false;
		sequence : ParseFunction[];
		autoParseWhitespace: bool = undefined;

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
		//TODO: list matcher with separator A{separate: B}*
		//TODO: non lazy or matcher?
		//TODO: some way to group parts of the language with and without whitespaces

		private static regexMatcher(regex: RegExp);
		private static regexMatcher(regex: string, ignoreCase: bool = false);
		private static regexMatcher(regex: any, ignoreCase: bool = false): (p:Parser) => any {
			var r = new RegExp("^" + (regex.source || regex), regex.flags || (ignoreCase ? "i" : ""));
			return (parser: Parser) : any => {
				var match = parser.getRemainingInput().match(r);
				if (match) {
					parser.currentPos += match[0].length;
					return match[0];
					//TODO: return complex object with raw and unquoted values?
				}
				return undefined;
			}
		}

		public static regex(regex: RegExp, ignoreCase: bool = false): ParseFunction {
			return new ParseFunction(
				"/" + regex.source + "/" /*TODO: quote? */,
				regexMatcher(regex),
				{ isTerminal: true });
		}

		public static characterClass(regexstr: string, ignoreCase: bool = false): ParseFunction {
			return new ParseFunction(
				regexstr /*TODO: quote?*/,
				regexMatcher(regexstr, ignoreCase),
				{ isCharacterClass: true, isTerminal: true });
		}

		public static literal(keyword: string, ignoreCase: bool = false): ParseFunction {
			return new ParseFunction(
				"'" + keyword + "'",
				regexMatcher(RegExpUtil.quoteRegExp(keyword) + (keyword.match(/\w$/) ? "\\b" : ""), ignoreCase),
				{ isKeyword: true, isTerminal: true });
		}

		public static dot(): ParseFunction {
			return new ParseFunction(".", regexMatcher(/./), { isCharacterClass: true, isTerminal: true });
		}

		public static call(ruleName: string): ParseFunction { //TODO: rename to call
			return new ParseFunction(ruleName, p => {
				var rule= p.grammar.rule(ruleName);
				var prevWhitespace = p.autoParseWhitespace;
				try { //Optimization: only put in try..finally if parseWhitespace will be changed by this rule
					if (rule.autoParseWhitespace !== undefined)
						p.autoParseWhitespace = rule.autoParseWhitespace;
					p.parse(p.grammar.rule(ruleName))
				}
				finally {
					p.autoParseWhitespace = prevWhitespace;
				}
			});
		}

		public static list(matcher: ParseFunction, atleastOne : bool = false, separator : ParseFunction = null): ParseFunction {
			return new ParseFunction(
				matcher.toString() + (atleastOne ? "+" : "*") + (separator ? "?" : ""),
				(parser: Parser): any => {
					var res = [];
					var item, sep;
					do {
						//TODO: check if previous rule did consume something, else throw non-terminating rule
						item = parser.parse(matcher);
						if (item !== undefined)
							res.push(item);
					} while (item !== undefined && (!separator || parser.parse(separator) !== undefined));

					return atleastOne && !res.length ? undefined : res;
			});
		}

		public static optional(matcher: ParseFunction): ParseFunction {
			return new ParseFunction(matcher.toString() + "?", (parser: Parser): any => {
				var res = parser.parse(matcher);
				return res === undefined ? null : res;
			});
		}

		public static sequence(...items: ParseFunction[]): ParseFunction {
			//if (items.length == 1 && !items[0].ruleName) //Not top level, and not a real sequence
			//	return items[0];

			var wrapAst = items.filter(x => x.label).length > 1;

			return Util.extend(new ParseFunction(
				"(" + items.map(i => i.toString()).join(" ") + ")",
				(parser: Parser): any => {
					var result = {};
					var success = items.every(item => {
						var itemres = parser.parse(item);
						if (item.label) {//we are interested in the result
							if (wrapAst)
								result[item.label] = itemres; //TODO: probably index based matched should NOT be stored like in PegJS. That will make the AST cleaner
							else
								result = itemres;
						}
						return itemres !== undefined;
					});

					return success ? result : undefined;
				}),
				{ sequence : items});
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

		public static set(...items: ParseFunction[]): ParseFunction {
			return new ParseFunction(
				"(" + items.map(x => x.toString()).join(" ") + ")#",
				(parser: Parser): any => {
					var left : ParseFunction[] = [].concat(items),
						l : number, res = {};
					do {
						l = left.length;
						for(var i = l -1; i >= 0; i--) {
							var item = parser.parse(left[i]);
							if (item !== undefined) {
								left.splice(i, 1);
								if (item.label)
									res[item.label] = item;
							}
						}
					} while (left.length && l != left.length)
					return res; //set matcher always succeeds. It might just have matched nothing
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
			return load(CLI.readStringFromFile(filename));
		}

		public addRule(rule: ParseFunction): ParseFunction;
		public addRule(name: string, rule: ParseFunction, replace: bool = false): ParseFunction;
		public addRule(arg1: any, arg2?: ParseFunction, replace: bool = false) : ParseFunction {
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

		public updateRule(name: string, rule: ParseFunction): ParseFunction {
			return this.addRule(name, rule, true);
		}

		public clone() : Grammar {
			var res = new Grammar();
			Util.extend(res, {
				rules : [].concat(this.rules),
				whitespaceMatcher : this.whitespaceMatcher,
				startSymbol: this.startSymbol
			});
			return res;
		}

		public rule(ruleName: string): ParseFunction {
			if (!this.rules[ruleName])
				throw new Error("Rule '" + ruleName + "' is not defined");
			return this.rules[ruleName];
		}

		public parse(input: string, opts: { startSymbol?: string; inputName?: string; debug?: bool; } = {}): any {
			//TODO: store inputName and show in exceptions
			//TODO: use 'debug' for logging
			return new Parser(this, input).parseInput(MatcherFactory.call(opts.startSymbol || this.startSymbol));
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
		public debug = false; //TODO: false
		private previousIsCharacterClass = false;
		private isParsingWhitespace = false;
		autoParseWhitespace = false;
		private stack: StackItem[] = []; //TODO: is stack required anywhere?
		expected = [];
		//TODO: with-parse-information option (that generates $rule and $start and such..)

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
				if (this.currentPos < this.input.length) {
					if (this.currentPos == this.expected.length -1) //we parsed something valid, but we expected more..
						throw new ParseException(this, "Found superflous input after parsing");
					throw new ParseException(this, "Failed to parse");
				}
				return res;
			}
		}

		parse(func: ParseFunction): any {
			var startpos = this.currentPos,
				isMatch = false,
				result = undefined;

			try {
				//consume whitespace
				if (!this.isParsingWhitespace && this.autoParseWhitespace)
					this.consumeWhitespace();

				this.stack.push({ func: func, startPos : this.currentPos}); //Note, not startpos.

				//check memoization cache
				if (this.isMemoized(func)) {
					if (this.debug && !this.isParsingWhitespace)
						Util.debug(Util.leftPad(" /" + func.toString() + " ? (memo)", this.stack.length, " |"));

					result = this.consumeMemoized(func);
				}

				else {
					if (this.debug && !this.isParsingWhitespace)
						Util.debug(Util.leftPad(" /" + func.toString() + " ?", this.stack.length, " |"));

					//store expected
					if (func.isTerminal && !this.isParsingWhitespace) {
						if (!this.expected[this.currentPos])
							this.expected[this.currentPos] = [];
						this.expected[this.currentPos].push(func.friendlyName || func.ruleName || func.toString());
					}

					//finally... parse!
					result = func.parse(this);

					//enrich result with match information
					if (result !== null && result !== undefined && !result.$rule)
						Util.extend(result, { $start : startpos, $end : this.currentPos, $rule : func.ruleName }); //TODO; only if object?

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

				if (isMatch && !this.isParsingWhitespace && this.autoParseWhitespace)
					this.consumeWhitespace();
				else
					this.currentPos = startpos; //rewind

				if (this.debug && !this.isParsingWhitespace)
					Util.debug(Util.leftPad(" \\" + func.toString() + (isMatch ? " V" : " X"), this.stack.length, " |") + " @" + this.currentPos);

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
				this.isParsingWhitespace = true;
				this.parse(this.grammar.whitespaceMatcher);
				this.isParsingWhitespace = false;
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

		private static mixinDefaultRegexes(g: Grammar) {
			for (var key in RegExpUtil)
				if (RegExpUtil[key] instanceof RegExp)
					g.addRule(key, MatcherFactory.regex(RegExpUtil[key]));
		}

		private static bootstrap(): Grammar {
			var seq = f.sequence, label = f.labeled, opt = f.optional, choice = f.choice, list = f.list, lit = f.literal, call = f.call;
			var g = new Grammar(), f = MatcherFactory;
			mixinDefaultRegexes(g);

			//rules
			var str     = g.addRule('string', choice(call('singleQuoteString'), call('doubleQuoteString')));
			var literal = g.addRule('literal', seq(str, opt(lit("i"))));
			var ws = g.addRule('whitespace', choice(call('whitespacechar'), call('multilinecomment'), call('singlelinecomment')));
			var identifier = call('identifier');

			var paren   = g.addRule('paren', seq(lit('('), label('expression', call('expression')), lit(')')));
			var callRule = g.addRule('call',
				seq(label('name', identifier),
				f.negativeLookAhead(seq(opt(str), lit('=')))));
			var importRule = g.addRule('import', seq(f.literal('@import'), label('grammar', identifier), lit('.'), label('rule', identifier)));

			var primary = g.addRule('primary', choice(
			  callRule,
			  literal,
			  call('characterClass'),
			  lit('.'),
			  importRule,
			  paren));

			var suffixed = g.addRule('suffixed',
			  seq(label('expression', primary), label('suffix', opt(choice(
			    lit('?'), lit('*?'), lit('+?'), lit('*'), lit('+'), lit('#'))))));

			var prefixed = g.addRule('prefixed', seq(
			  label('prefix', opt(choice(lit('$'), lit('&'), lit('!')))),
			  label('expression', suffixed)));

			var labeled = g.addRule('labeled', seq(
			  label('label', opt(seq(identifier, lit(':')))),
			  label('expression', prefixed)));

			var sequence = g.addRule('sequence', choice(call('regexp'), f.list(labeled, true)));

			var choicerule = g.addRule('choice', list(sequence, true, lit('/')));

			var expression = g.addRule('expression', choicerule);

			var whitespaceflag = g.addRule('whitespaceflag', f.regex(/@whitespace-on|@whitespace-off/));

			var rule = g.addRule('rule',
				seq(label('name', identifier),
				label('displayName', opt(str)),
				lit('='),
				label('autoParseWhitespace', opt(whitespaceflag)),
				label('expression', expression),
				opt(lit(';'))));

			g.addRule('grammar', label('rules', f.list(rule, true)));

			g.startSymbol = "grammar";
			return g;
		}

		public static buildGrammar(ast: any): Grammar {
			var g = new Grammar();
			(<any[]>ast/*.rules*/).forEach((ast: any) => {
				var r = astToMatcher(ast.expression);
				if (ast.displayName)
					r.friendlyName = ast.displayName;
				if (ast.whitespaceFlag)
					r.autoParseWhitespace = ast.autoParseWhitespace == '@whitespace-on'
					//TODO: if there is at least one rule with a whitespace flag, the
					//'whitespace' rule should exist!
				g.addRule(ast.name, r);
			});

			//TODO: consistency check?
			return g;
		}

		static astToMatcher(ast: any): ParseFunction {
			//TODO: this in a closure to remember literals
			//TODO: remember all 'calls' to be later to check whether all rules can be resolved
			//TODO: reuse member call matchers as well!
			var f = MatcherFactory;
			if (ast === null)
				return null;
			switch (ast.$rule) {
				case "identifier":
					return ast; //return the same string
				case "singleQuoteString":
				case "doubleQuoteString":
					return f.literal(RegExpUtil.unescapeQuotedString(ast)); //TODO: 'i' flag //TODO: if not already created, in that case, use from cache
				case "regex":
					return f.regex(RegExpUtil.unescapeRegexString (ast)); //TODO: 'i' flag
				case "characterClass":
					return f.characterClass(RegExpUtil.unescapeRegexString(ast).source); //TODO: 'i' flag
				case "call":
					return f.call(ast.name);
				case "suffixed":
					switch (ast.postfix) {
						case "?": return f.optional(astToMatcher(ast.expression));
						case "#":
						//TODO: assert sequence with size < 2
							var seq = astToMatcher(ast.expression);
							return f.set.apply(f, seq.sequence ? seq.sequence : [seq]);
						case "*": return f.list(astToMatcher(ast.expression), false);
						case "+": return f.list(astToMatcher(ast.expression), true);
						case "*?":
						case "+?":
						//TODO: throw exception if seq is not a sequence or size is smaller than 2.
							var seq = astToMatcher(ast.expression);
							var sep = seq.sequence && seq.sequence.length ? seq.sequence[seq.sequence.length] : null;
							return f.list(f.sequence.apply(f, seq.sequence.slice(0, -1)), ast.postfix === "+?", sep);
						default: throw new Error("Unimplemented postfix: " + ast.postfix);
					}
				case "prefixed":
					switch (ast.prefix) {
					//TODO:	case "$": return f.dollar(astToMatcher(ast.expression));
						case "&": return f.positiveLookAhead(astToMatcher(ast.expression));
						case "!": return f.negativeLookAhead(astToMatcher(ast.expression));
						default: throw new Error("Unimplemented prefix: " + ast.prefix);
					}
				case "labeled":
					return f.labeled(ast.label, astToMatcher(ast.expression));
				case "sequence":
					return f.sequence.apply(f, ast.map(astToMatcher));
				case "expression": //TODO: should be either of them,  not both
				case "choice":
					return f.choice.apply(f, ast.map(astToMatcher));

				default:
					throw new Error("Unimplemented ruletype: " + ast.$rule);
			}
		}
	}

	export class RegExpUtil {
		//TODO: check if all regexes do not backtrack!
		public static identifier = /[a-zA-Z_][a-zA-Z_0-9]*/;
		public static whitespaceChar = /\s+/;
		public static regex = /\/([^\\\/]|(\\.))*\//; //TODO: unescape regex is remove the begin and end + double all backslashes
		public static singleQuoteString = /'([^'\\]|(\\.))*'/; //TODO: or /(["'])(?:\\\1|[^\1])*?\1/g, faster?
		public static doubleQuoteString = /"([^"\\]|(\\.))*"/;
		public static singleLineComment = /\/\/.*(\n|$)/;
		public static multiLineComment = /\/\*(?:[^*]|\*(?!\/))*?\*\//;
		public static characterClass = /\[([^\\\/]|(\\.))*\]/;
		public static integer = /-?\d+/;
		public static float = /-?\d+(\.\d+)?(e\d+)?/;
		public static boolean = /(true|false)\b/;
		public static lineendChar = /\r?\n|\u2028|\u2029/;

		public static quoteRegExp(str: string): string {
			return (str + '').replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
		}

		/**
			Given a string in javascript regex format e.g. /slash\/backslash\\end/
			transforms it to a RegExp
		*/
		public static unescapeRegexString(str: string): RegExp {
			return new RegExp(str.substring(1, str.length - 2).replace(/\\/g, "\\"));
		}

		/**
			Given a string an javascript string format, e.g. (including the quotes) "line\nnewline\"quote",
			transforms it to a string
		*/
		public static unescapeQuotedString(str: string) {
			return str.substring(1, str.length - 2)
				.replace(/\\\\/g, "\\")
				.replace(/\\n/g, "\n")
				.replace(/\\r/g, "\r")
				.replace(/\\t/g, "\t")
				.replace(/\\f/g, "\f")
				.replace(/\\b/g, "\b")
				.replace(/\\'/g, "'")
				.replace(/\\"/g, "\"")
				.replace(/\\0/g, "\0")
				//http://stackoverflow.com/questions/7885096/how-do-i-decode-a-string-with-escaped-unicode
				.replace(/\\u(d){4}/, (m,code) => String.fromCharCode(parseInt(code, 16)))
				.replace(/\\x(d){2}/, (m,code) => parseInt(code, 16))
				.replace(/\\0(d){2}/, (m,code) => parseInt(code, 8))
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
			var lines = input.substring(0, pos).split(RegExpUtil.lineendChar);
			var curline = input.split(RegExpUtil.lineendChar)[lines.length -1];
			lines.pop(); //remove curline
			var col = pos - lines.join().length;

			return {
				line : lines.length + 1,
				col : col,
				linetext : curline,
				linetrimmed: curline.replace(/(^\s+)|(\s+$)/g,"").replace(/\t/," "), //trim and replace tabs
				linehighlight : Util.leftPad("^", col - (curline.length - curline.replace(/^\s+/,"").length) - 1 , "-") //correct padding for trimmed whitespacse
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

	export class CLI {
		public static main() {
			//CLI definition. Thank you, optimist :)
			var argv = require('optimist')
				.usage("Miniup parser. Given a Programmable Expression Grammar (PEG), transforms input into a JSON based Abstract Syntax Tree."
					+ "\nUsage: miniup <input>"
					+ "\nUsage: stdin | miniup"
					+ "\nUsage: miniup -i <input file>"
					+ "\nUsage: miniup -g <grammar string> <input>"
					+ "\nUsage: miniup -[vc] -s <grammar file> -i <input file> -o <output file>"
					+ "\nUsage: miniup -h")
				.describe('g', 'Grammar definition (defaults to Miniup grammar)').alias('g', 'grammar')
				.describe('i', 'Input file').alias('i', 'input')
				.describe('s', 'Read grammar from file')
				.describe('o', 'Output file').alias('o', 'output')
				.describe('v', 'Verbose')
				.describe('c', 'Clean AST. Do not enrich the AST with parse information').alias("c", "clean")
				.describe('h', 'Print this help').alias('help')
				.default({ c: false, v: false })
				.boolean('vch'.split(''))
				.string("giso".split(''))
				.argv;

			//help
			var args = argv._, grammar: Grammar;
			if (argv.h) {
				argv.help();
				process.exit(0);
			}

			//get the grammar
			if (argv.s)
				grammar = Grammar.loadFromFile(argv.s)
			else if (argv.g)
				grammar = miniup.Grammar.load(argv.g)
			else
				grammar = miniup.GrammarReader.getMiniupGrammar();

			function processInput (input: string) => {
				try {
					//parse
					var res = grammar.parse(input, {
						debug: argv.v,
						cleanAST: argv.c
					});

					//store
					if (argv.o)
						writeStringToFile(argv.o, JSON.stringify(res))
					else
						console.log(JSON.stringify(res, null, 2));
				}
				catch (e) {
					if (e instanceof miniup.ParseException) {
						console.error(e.toString());
						process.exit(1);
					}
					else
						throw e;
				}
			}

			//get the input
			if (argv.i)
				processInput(readStringFromFile(argv.i))
			else if (argv._.length)
				processInput(argv._.join(" "))
			else
				readStringFromStdin(processInput);
		}

		public static readStringFromFile(filename: string): string {
			return require('fs').readFileSync(filename, "utf8")
		}

		public static writeStringToFile(filename: string, contents: string) {
			return require('fs').writeFileSync(filename, contents, { encoding: "utf8" });
		}

		public static readStringFromStdin(cb: (str: string) => void ) {
			//http://stackoverflow.com/questions/13410960/how-to-read-an-entire-text-stream-in-node-js
			var content = '';
			process.stdin.resume();
			process.stdin.on('data', function (buf) { content += buf.toString(); });
			process.stdin.on('end', function () {
				cb(content);
			});
		}
	}
}

//TODO: fixme: still strugling with the typescript module export system. Lets work around..
(function(root) {
//var exports = root['exports'];
	if (typeof(exports) !== "undefined") for(var key in miniup)
		exports[key] = miniup[key];
})(this);

//root script?
if ((typeof (module ) !== "undefined" && !module.parent))
	miniup.CLI.main();