// Some global environment stuff we use..
//TODO: error handling, friendly  name instead of characterclasses for example. Do not show regexes?
//TODO: make a sequence of non labeled items return the only truthy value if applicable?
declare var exports : any;
declare var module: any;
declare var require: any;
declare var process : any;

module miniup {

	export class ParseFunction {
		ruleName : string;
		friendlyName : string;
		memoizationId: number; //TODO: should not be needed anymore, reuse toString()//but that ight breakwith imports?
		isLiteral = false;
		isCharacterClass = false;
		isTerminal = false;
		sequence : ISequenceItem[];
		autoParseWhitespace: boolean = undefined;

		constructor(private asString: string, public parse : (parser: Parser) => any, opts? : Object) {
			if (opts)
				Util.extend(this, opts);
		}

		public toString(): string {
			return this.ruleName ? this.ruleName : "" + this.asString;
		}
	}

	export interface ISequenceItem { label? : string; expr: ParseFunction; }

	export class MatcherFactory {

		public static importMatcher(language: string, rule: string) {
			var call = MatcherFactory.call(rule);

			return new ParseFunction(
				"@" + language + "." + rule,
				p => {
					var thisGrammar = p.grammar;
					var g = Grammar.get(language);
					try {
						p.grammar = g;
						return p.parse(call);
					}
					finally {
						p.grammar = thisGrammar;
					}
				});
		}

		private static regexMatcher(regex: RegExp);
		private static regexMatcher(regex: string);
		private static regexMatcher(regex: string, ignoreCase: boolean);
		private static regexMatcher(regex: any, ignoreCase: boolean = false): (p:Parser) => any {
			var r = new RegExp("^" + (regex.source || regex), regex.ignoreCase || ignoreCase ? "i" : "");
			return (parser: Parser) : any => {
				var match = parser.getRemainingInput().match(r);
				if (match) {
					parser.currentPos += match[0].length;
					return match[0];
				}
				return undefined;
			}
		}

		public static regex(regex: RegExp, ignoreCase: boolean = false): ParseFunction {
			return new ParseFunction(
				regex.toString(),
				MatcherFactory.regexMatcher(regex),
				{ isTerminal: true });
		}

		public static characterClass(regexstr: string, ignoreCase: boolean = false): ParseFunction {
			return new ParseFunction(
				regexstr.toString(),
				MatcherFactory.regexMatcher(regexstr, ignoreCase),
				{ isCharacterClass: true, isTerminal: true });
		}

		public static literal(keyword: string, ignoreCase: boolean = false): ParseFunction {
			//TODO: clanup all this regex construction stuff and parsing / unparsing
			var regexmatcher = MatcherFactory.regexMatcher(new RegExp(RegExpUtil.quoteRegExp(keyword), ignoreCase ? "i" : ""));
			return new ParseFunction(
				"'" + keyword + "'",
				p => {
					var res = regexmatcher(p);
					if (res && p.autoParseWhitespace && res.match(/\w$/) && p.getRemainingInput().match(/^\w/))
						return undefined; //fail if auto parse whitespace is enabled and we end in the middle of a word
					return res;
				},
				{ isLiteral: true, isTerminal: true });
		}

		public static dot(): ParseFunction {
			return new ParseFunction(".", MatcherFactory.regexMatcher(/./), { isCharacterClass: true, isTerminal: true });
		}

		public static dollar(matcher: ParseFunction): ParseFunction {
			return new ParseFunction(
				"$" + matcher.toString(),
				p => {
					var start = p.currentPos;
					var res = p.parse(matcher);
					if (res !== undefined) {
						var end = p.currentPos;
						return p.getInput().substring(start, end).trim(); //MWE: trim. Really?
					}
					return undefined;
				});
		}

		public static call(ruleName: string): ParseFunction { //Optimization: replace all call's directly with the rule when building the grammar.
			return new ParseFunction(ruleName, p => {
				var rule = p.grammar.rule(ruleName);
				var prevWhitespace = p.autoParseWhitespace;
				try { //Optimization: only put in try..finally if parseWhitespace will be changed by this rule
					if (rule.autoParseWhitespace !== undefined)
						p.autoParseWhitespace = rule.autoParseWhitespace;

					return p.parse(rule);
				}
				finally {
					p.autoParseWhitespace = prevWhitespace;
				}
			});
		}

		public static list(matcher: ParseFunction, atleastOne : boolean = false, separator : ParseFunction = null, storeSeparator : boolean = false): ParseFunction {
			return new ParseFunction(
				"(" + matcher.toString() + (separator ? " " +separator.toString() : "") + ")" + (atleastOne ? "+" : "*") + (separator ? "?" : ""),
				(parser: Parser): any => {
					var res = [];
					var item, sep = undefined;
					do {
						//TODO: check if previous rule did consume something, else throw non-terminating rule
						if (sep !== undefined && storeSeparator)
							res.push(sep);
						item = parser.parse(matcher);
						if (item !== undefined)
							res.push(item);
					} while (item !== undefined && (!separator || (sep = parser.parse(separator)) !== undefined));

					return atleastOne && !res.length ? undefined : res;
			});
		}

		public static optional(matcher: ParseFunction): ParseFunction {
			return new ParseFunction(matcher.toString() + "?", (parser: Parser): any => {
				var res = parser.parse(matcher);
				return res === undefined ? null : res;
			});
		}

		public static sequenceItem(label: string, expr: ParseFunction): ISequenceItem;
		public static sequenceItem(expr: ParseFunction): ISequenceItem;
		public static sequenceItem(a, b?): ISequenceItem  {
			return { label: <string> (b ? a : undefined), expr: <ParseFunction> (b ? b : a)};
		}


		public static sequence(...items: ISequenceItem[]): ParseFunction {
			if (items.length == 1 && !items[0].label)
				return items[0].expr;

			return new ParseFunction(
				"(" + items.map(i => (i.label ? i.label + ":" : "") + i.expr.toString()).join(" ") + ")",
				(parser: Parser): any => {
					var result = {};
					var success = items.every(item => {
						var itemres = parser.parse(item.expr);
						if (item.label) //we are interested in the result
							result[item.label] = itemres;
						if (parser.extendedAST)
							result[-1 + ((<any>result).length = ((<any>result).length || 0) + 1)] = itemres;
						return itemres !== undefined;
					});

					return success ? result : undefined;
				},
				{ sequence : items});
		}

		public static choice(...choices: ParseFunction[]): ParseFunction {
			if (choices.length === 1)
				return choices[0];

			return new ParseFunction(
				"(" + choices.map(x => x.toString()).join(" | ") + ")",
				(parser: Parser): any => {
					var res;

					if (choices.some(choice => undefined !== (res = parser.parse(choice))))
						return res;
					return undefined;
				});
		}

		public static set(...items: ISequenceItem[]): ParseFunction {
			return new ParseFunction(
				"(" + items.map(i => (i.label ? i.label + ":" : "") + i.expr.toString()).join(" ") + ")#",
				(parser: Parser): any => {
					var left : ISequenceItem[] = [].concat(items),
						l : number, res = {};
					do {
						l = left.length;
						for(var i = l -1; i >= 0; i--) {
							var item = parser.parse(left[i].expr);
							if (item !== undefined) {
								if (left[i].label)
									res[left[i].label] = item;
								left.splice(i, 1);
							}
						}
					} while (left.length && l != left.length)

					left.forEach(i => i.label && (res[i.label] = null)); //make sure each label is available in the result

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
			var ppm = MatcherFactory.positiveLookAhead(predicate);
			return new ParseFunction("!" + predicate.toString(), (parser: Parser): any => {
				return parser.parse(ppm) === undefined ? null : undefined; //undefined == no match. null == match, so invert.
			});
		}

		public static operator(operator: ParseFunction, operand: ParseFunction, left: boolean): ParseFunction {
			function buildAST (items : any[]) {
				return items.length < 2 ? items[0] : {
					left : left ? buildAST(items.slice(0, -2)) : items[0],
					right: left ? items[items.length -1] : buildAST(items.slice(2)),
					op   : left ? items[items.length -2] : items[1]
				}
			}

			var listparser = MatcherFactory.list(operand, true, operator, true);

			return new ParseFunction(
				["@operator-" + (left?"left":"right"), operator, operand].join(' '),
				(parser: Parser): any => {
					var res =parser.parse(listparser);

					if (res.length === 1)
						return res[0];

					return buildAST(res);
			});
		}
	}

	export class Grammar {

		private rules = new Map<ParseFunction>();
		private static grammars : Map<Grammar> = {};
		whitespaceMatcher: ParseFunction;
		public startSymbol: string;

		public static get(grammarName: string): Grammar {
			if (Grammar.grammars[grammarName])
				return Grammar.grammars[grammarName]
			throw "Unregistered grammar: '" + grammarName + "'";
		}

		public static register(grammarName: string, grammar: Grammar) : Grammar {
			Grammar.grammars[grammarName] = grammar;
			return grammar;
		}

		public static load(grammarSource: string, inputName: string): Grammar {
			return new GrammarReader(grammarSource, inputName).build();
		}

		public static loadFromFile(filename: string): Grammar {
			return Grammar.load(CLI.readStringFromFile(filename), filename);
		}

		public addRule(rule: ParseFunction): ParseFunction;
		public addRule(name: string, rule: ParseFunction): ParseFunction;
		public addRule(name: string, rule: ParseFunction, replace: boolean): ParseFunction;
		public addRule(arg1: any, arg2?: ParseFunction, replace: boolean = false) : ParseFunction {
			var rule: ParseFunction = arg2 ? Util.extend(arg2, { ruleName: arg1 }) : arg1;
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

		public hasRule(name: string): boolean {
			return name in this.rules;
		}

		public clone() : Grammar {
			var res = new Grammar();
			Util.extend(res, {
				rules : Util.extend({}, this.rules),
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

		public parse(input: string, opts: IParseArgs = {}): any {
			//TODO: store inputName and show in exceptions
			//TODO: use 'debug' for logging
			return new Parser(this, input, opts).parseInput(MatcherFactory.call(opts.startSymbol || this.startSymbol));
		}

	}

	export interface StackItem { //TODO: remove
		func: ParseFunction;
		startPos: number;
	}

	interface MemoizeResult {
		result: any;
		endPos: number;
	}

	export interface IParseArgs {
		startSymbol?: string;
		inputName?: string;
		debug?: boolean;
		cleanAST?: boolean;
		extendedAST?: boolean;
	}

	export class Parser implements IParseArgs {
		debug: boolean = false;
		inputName: string = "input";
		cleanAST: boolean = false;
		extendedAST: boolean =false;

		private static nextMemoizationId = 1;
		private static RecursionDetected = { recursion : true };

		currentPos: number = 0;
		private memoizedParseFunctions = {}; //position-> parseFunction -> MemoizeResult
		private isParsingWhitespace = false;
		autoParseWhitespace = false;
		private stack: StackItem[] = []; //TODO: is stack required anywhere?
		expected = []; //pos -> [ expecteditems ]

		constructor(public grammar: Grammar, public input: string, opts: IParseArgs = {}) {
			Util.extend(this, opts);
		}

		public getRemainingInput(): string {
			return this.input.substring(this.currentPos);
		}

		public getInput(): string { return this.input; }

		parseInput(func: ParseFunction) : any {
			var res = this.parse(func);
			if (res === undefined) {
				if (this.expected.length >= this.input.length)
					throw new ParseException(this, "Unexpected end of input");
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
					if (result == Parser.RecursionDetected) {
						if (this.debug)
							Util.debug(Util.leftPad(" | (recursion detected)", this.stack.length, " |"))
						throw new ParseException(this, "Grammar error: Left recursion found in rule '" + func.toString() + "'");
					}
				}

				else {
					this.memoizedParseFunctions[func.memoizationId][startpos] = {
						result: Parser.RecursionDetected,
						endPos: this.currentPos
					}

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
					if (!this.cleanAST && result instanceof Object && !result.$rule)
						Util.extend(result, { $start : startpos, $text : this.getInput().substring(startpos, this.currentPos), $rule : func.ruleName });

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
					if (!this.isParsingWhitespace && this.autoParseWhitespace)
						this.consumeWhitespace();
				}
				else
					this.currentPos = startpos; //rewind

				if (this.debug && !this.isParsingWhitespace)
					Util.debug(Util.leftPad(" \\" + func.toString() + (isMatch ? " V" : " X"), this.stack.length, " |") + " @" + this.currentPos);

				this.stack.pop();
			}
		}

		isMemoized(func: ParseFunction): boolean {
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
			if (!this.grammar.whitespaceMatcher)
				throw "Whitespace matcher has not been defined!";
			this.isParsingWhitespace = true;
			this.parse(this.grammar.whitespaceMatcher);
			this.isParsingWhitespace = false;
		}
	}

	export class ParseException {
		public name = "Miniup.ParseException";
		public message : string;
		public coords: TextCoords;

		constructor(parser: Parser, message: string) {
			var pos = Math.max(parser.currentPos, parser.expected.length - 1);
			this.coords = Util.getCoords(parser.input, pos);

			this.message = Util.format("{1}({2},{3}): {0}\n{4}\n{5}\nExpected {6}",
				message,
				parser.inputName,
				this.coords.line, this.coords.col,
				this.coords.linetrimmed,
				this.coords.linehighlight,
				parser.expected[pos] ? parser.expected[pos].join(" or ") : "<nothing>"
			);
		}

		public toString():string { return this.name + ": " + this.message }

		public getColumn():number { return this.coords.col; }
		public getLineNr():number { return this.coords.line;}
	}

	export class GrammarReader {
		private static miniupGrammar: Grammar = null;

		public static getMiniupGrammar(): Grammar {
			if (GrammarReader.miniupGrammar == null)
				GrammarReader.miniupGrammar = GrammarReader.bootstrap();
			return GrammarReader.miniupGrammar;
		}

		private static mixinDefaultRegexes(g: Grammar) {
			for (var key in RegExpUtil)
				if (RegExpUtil[key] instanceof RegExp)
					g.addRule(key, MatcherFactory.regex(RegExpUtil[key]));
		}

		private static bootstrap(): Grammar {
			var g = new Grammar(), f = MatcherFactory;
			var seq = f.sequence, opt = f.optional, choice = f.choice, list = f.list, lit = f.literal, call = f.call, si = MatcherFactory.sequenceItem;
			GrammarReader.mixinDefaultRegexes(g);

			//rules
			var str     = g.addRule('string', choice(call('SINGLEQUOTESTRING'), call('DOUBLEQUOTESTRING')));
			var literal = g.addRule('literal', seq(si('text', str), si('ignorecase', opt(lit("i")))));
			var ws = g.addRule('whitespace', choice(call('WHITESPACECHARS'), call('MULTILINECOMMENT'), call('SINGLELINECOMMENT')));
			var identifier = call('IDENTIFIER');
			var regex = g.addRule('regex', seq(si('text', call('REGEX'))));

			var paren   = g.addRule('paren', seq(si(lit('(')), si('expr', call('expression')), si(lit(')'))));
			var callRule = g.addRule('call', seq(
			  si('name', identifier),
			  si(MatcherFactory.negativeLookAhead(seq(si(opt(str)), si(choice(lit('='),lit('<-'))))))));
			var importRule = g.addRule('import', seq(
			  si(lit('@import')),
			  si('grammar', identifier),
			  si(lit('.')),
			  si('rule', identifier)));

			var primary = g.addRule('primary', choice(
			  callRule,
			  literal,
			  g.addRule('characters', seq(si('text', call('CHARACTERCLASS')), si("ignorecase", opt(lit("i"))))),
			  lit('.'),
			  importRule,
			  paren));

			var suffixed = g.addRule('suffixed', choice(seq(
			  si('expr', primary),
			  si('suffix', choice(lit('?'), lit('*?'), lit('+?'), lit('*'), lit('+'), lit('#')))),
			  primary));

			var prefixed = g.addRule('prefixed', choice(seq(
			  si('prefix', choice(lit('$'), lit('&'), lit('!'))),
			  si('expr', suffixed)),
			  suffixed));

			var labeled = g.addRule('labeled', choice(
			  seq(si('label', identifier), si(lit(':')), si('expr', choice(regex, prefixed))),
			  seq(si('expr', prefixed))));

			var sequence = g.addRule('sequence', f.list(labeled, true));

			var choicerule = g.addRule('choice', list(choice(regex, sequence), true, lit('/')));

			var expression = g.addRule('expression', choicerule);

			var whitespaceflag = g.addRule('whitespaceflag', f.regex(/@whitespace-on|@whitespace-off/));

			var rule = g.addRule('rule', seq(
			  si('name', identifier),
			  si('displayName', opt(str)),
			  si(choice(lit('='),lit('<-'))),
			  si('autoParseWhitespace', opt(whitespaceflag)),
			  si('expr', expression),
			  si(opt(lit(';')))));

			g.addRule('grammar', Util.extend(
				seq(si('rules', f.list(rule, true))),
				{ autoParseWhitespace: true }));

			g.startSymbol = "grammar";
			return g;
		}

		private requiredRules : Array<{ ast: any; name: string; }> = [];
		private allMatchers : Object = {}; //rulestring -> matcher
		private errors : { msg:string; ast:any; }[] =[];


		constructor(private input: string, private inputName: string = "grammar source"){}

		public build(): Grammar {
			var ast = GrammarReader.bootstrap().parse(this.input);
			var g = new Grammar();

			(<any[]>ast.rules).forEach((ast: any) => {
				var r = this.astToMatcher(ast.expr);
				if (ast.displayName)
					r.friendlyName = ast.displayName;
				if (ast.autoParseWhitespace)
					r.autoParseWhitespace = ast.autoParseWhitespace == '@whitespace-on'
				g.addRule(ast.name, r);
			});

			//auto load default tokens. Do not do this up front, since the first declared rules is the start symbol
			GrammarReader.mixinDefaultRegexes(g);

			if (!g.hasRule("whitespace"))
				g.addRule("whitespace", MatcherFactory.call("WHITESPACECHARS"));

			this.consistencyCheck(g);

			return g;
		}

		consistencyCheck(g: Grammar) {
			//check required rules
			this.requiredRules.forEach(req => {
				if (!g.hasRule(req.name))
					this.errors.push({ msg: "Undefined rule: '" + req.name + "'", ast: req.ast })
			});

			if (this.errors.length > 0)
				throw this.errors.map(e => {
					var coords = Util.getCoords(this.input, e.ast.$start)
					return Util.format("Invalid grammar: at {0} ({1},{2}): {3}", this.inputName, coords.line, coords.col, e.msg)
				}).join("\n");
		}

		astToMatcher(ast: any): ParseFunction {
			return this.cache(this.astToMatcherInner(ast));
		}

		//TODO: move to grammar?
		cache(f: ParseFunction) : ParseFunction {
			var name = f.toString();
			if (this.allMatchers[name])
				return this.allMatchers[name];
			return this.allMatchers[name] = f;
		}

		astToMatcherInner(ast: any): ParseFunction {
			var f = MatcherFactory;
			if (ast === null)
				return null;
			switch (ast.$rule) {
				case "literal":
					return f.literal(RegExpUtil.unescapeQuotedString(ast.text), ast.ignorecase === "i"); //TODO:ast.ignorecase for 'i' flag //TODO: if not already created, in that case, use from cache
				case "regex":
					return f.regex(RegExpUtil.unescapeRegexString(ast.text));
				case "characters":
					var regexstr = "/" + ast.text + "/" + (ast.ignorecase == "i" ? "i " : "");
					return f.characterClass(RegExpUtil.unescapeRegexString(regexstr).source);
				case "paren":
					return this.astToMatcher(ast.expr);
				case "call":
					this.requiredRules.push({name : ast.name, ast: ast})
					return f.call(ast.name);
				case "suffixed":
					switch (ast.suffix) {
						case "?": return f.optional(this.astToMatcher(ast.expr));
						case "#":
							var seq = this.astToMatcherInner(ast.expr);
							if (!seq.sequence || seq.sequence.length < 2) {
								this.errors.push({ ast: ast, msg: "A set ('#') should consist of at least two items"})
								//return null; //hmmm
							}
							return f.set.apply(f, seq.sequence);
						case "*": return f.list(this.astToMatcher(ast.expr), false);
						case "+": return f.list(this.astToMatcher(ast.expr), true);
						case "*?":
						case "+?":
							var seq = this.astToMatcherInner(ast.expr);
							var sep : ParseFunction;
							if (!seq.sequence || seq.sequence.length < 2) {
								this.errors.push({ ast: ast, msg: "Lists with separators ('*?' or '+?') should consist of at least two items"})
								//return null; //hmmm
							}
							else
								sep = seq.sequence.pop().expr;

							if (seq.sequence && seq.sequence.length == 1 && !seq.sequence[0].label) //one left? not a sequency anymore
								seq = seq.sequence[0].expr;

							return f.list(this.cache(seq), ast.suffix === "+?", sep ? this.cache(sep) : null);
						default: throw new Error("Unimplemented suffix: " + ast.suffix);
					}
				case "prefixed":
					switch(ast.prefix) {
						case "$": return f.dollar(this.astToMatcher(ast.expr));
						case "&": return f.positiveLookAhead(this.astToMatcher(ast.expr));
						case "!": return f.negativeLookAhead(this.astToMatcher(ast.expr));
						default: throw new Error("Unimplemented prefix: " + ast.prefix);
					}
				case "sequence":
					return f.sequence.apply(f, ast.map(item => f.sequenceItem(item.label, this.astToMatcher(item.expr))));
				case "expression":
					return f.choice.apply(f, ast.map(this.astToMatcher, this));
				case "import":
					return f.importMatcher(ast.grammar, ast.rule);
				default:
					throw new Error("Unimplemented ruletype: " + ast.$rule);
			}
		}
	}

	export class RegExpUtil {
		public static IDENTIFIER = /[a-zA-Z_][a-zA-Z_0-9]*/;
		public static WHITESPACECHARS = /\s+/;
		public static REGEX = /\/([^\\\/]|(\\.))*\/i?/;
		public static SINGLEQUOTESTRING = /'([^'\\]|(\\.))*'/;
		public static DOUBLEQUOTESTRING = /"([^"\\]|(\\.))*"/;
		public static SINGLELINECOMMENT = /\/\/.*(\n|$)/;
		public static MULTILINECOMMENT = /\/\*(?:[^*]|\*(?!\/))*?\*\//;
		public static CHARACTERCLASS = /\[([^\\\]\[]|(\\.))*\]/;
		public static INTEGER = /(-|\+)?\d+/;
		public static FLOAT =  /[-+]?[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/;
		public static BOOLEAN = /(true|false)\b/;
		public static LINEENDCHAR = /\r?\n|\u2028|\u2029/;

		public static quoteRegExp(str: string): string {
			return (str + '').replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
		}

		/**
			Given a string in javascript regex format e.g. /slash\/backslash\\end/
			transforms it to a RegExp
		*/
		public static unescapeRegexString(str: string): RegExp {
			return new RegExp(str.substring(1, str.length - 1).replace(/\\/g, "\\"), str.substring(1 + str.lastIndexOf("/")));
		}

		/**
			Given a string an javascript string format, e.g. (including the quotes) "line\nnewline\"quote",
			transforms it to a string
		*/
		public static unescapeQuotedString(str: string) {
			return str.substring(1, str.length - 1)
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
				.replace(/\\x(d){2}/, (m,code) => "" + parseInt(code, 16))
				.replace(/\\0(d){2}/, (m,code) => "" + parseInt(code, 8))
		}
	}

	export interface TextCoords {
		line: number;
		col: number;
		linetext: string;
		linetrimmed: string;
		linehighlight: string;
	}

	export class Map<U> {
		[name: string] : U
/* TODO: not possible :-(		public static clone<T>(map: map<T>) : Map<T> {
			return Util.extend(new Map<T>(), this);
		}
*/
	}

	export class Util {

		public static format(str: string, ...args: any[]) {
			return str.replace(/{(\d+)}/g, (match, nr) => "" + args[nr]);
		}

		public static extend<T>(thing: T, extendWith: Object): T {
			for (var key in extendWith)
				thing[key] = extendWith[key];
			return thing;
		}

		public static getCoords(input: string, pos: number): TextCoords {
			var lines = input.substring(0, pos).split(RegExpUtil.LINEENDCHAR);
			var curline = input.split(RegExpUtil.LINEENDCHAR)[lines.length -1];
			lines.pop(); //remove curline
			var col = pos - lines.join().length;

			return {
				line : lines.length + 1,
				col : col + 1, //do not use zero-indexes in messages
				linetext : curline,
				linetrimmed: curline.replace(/\t/," "), //trim and replace tabs
				linehighlight : Util.leftPad("^", col , "-") //correct padding for trimmed whitespacse
			}
		}

		public static leftPad(str: string, amount: number, padString: string = " ") {
			for (var i = 0, r = ""; i < amount; i++, r += padString);
			return r + str;
		}

		public static debug(msg: string, ...args: string[]) {
			console && console.log(Util.format.apply(null, [msg].concat(args)));
		}
	}

	export class CLI {
		public static main() {
			//CLI definition. Thank you, optimist :)
			var optimist = require('optimist')
				.usage("Miniup parser. Given a Programmable Expression Grammar (PEG), transforms input into a JSON based Abstract Syntax Tree.\n"
					+ "\nUsage: miniup <input>"
					+ "\nUsage: stdin | miniup -r"
					+ "\nUsage: miniup -i <input file>"
					+ "\nUsage: miniup -g <grammar string> <input>"
					+ "\nUsage: miniup -[vc] -s <grammar file> -i <input file> -o <output file>"
					+ "\nUsage: miniup -h")
				.describe('g', 'Grammar definition (defaults to Miniup grammar)').alias('g', 'grammar')
				.describe('i', 'Input file').alias('i', 'input')
				.describe('r', 'Read input from <stdin>')
				.describe('s', 'Read grammar from file')
				.describe('o', 'Output file').alias('o', 'output')
				.describe('v', 'Verbose')
				.describe('c', 'Clean AST. Do not enrich the AST with parse information').alias("c", "clean")
				.describe('e', 'Extended AST. Item without label will be added to the AST as well').alias("e", "extended")
				.describe('h', 'Print this help').alias('h', 'help')
				.boolean('rvceh'.split(''))
				.string("giso".split(''))

			//help
			var argv = optimist.argv, args = argv._, grammar: Grammar;
			var inputName = "input";

			if (argv.h) {
				optimist.showHelp();
				process.exit(0);
			}

			//get the grammar
			if (argv.s)
				grammar = Grammar.loadFromFile(argv.s)
			else if (argv.g)
				grammar = miniup.Grammar.load(argv.g, "input")
			else
				grammar = miniup.GrammarReader.getMiniupGrammar();

			function processInput (input: string) {
				try {
					//parse
					var res = grammar.parse(input, {
						debug: argv.v,
						cleanAST: argv.c,
						extendedAST: argv.e,
						inputName : inputName
					});

					//store
					if (argv.o)
						CLI.writeStringToFile(argv.o, JSON.stringify(res))
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
			if (argv.i) {
				inputName = argv.i;
				processInput(CLI.readStringFromFile(argv.i))
			}
			else if (argv.r) {
				inputName = "<stdin>";
				CLI.readStringFromStdin(processInput);
			}
			else if (argv._.length)
				processInput(argv._[0])
			else {
				console.error("Error: No input provided\n\n");
				optimist.showHelp();
			}
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