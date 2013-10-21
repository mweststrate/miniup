// Some global environment stuff we use..
//TODO: error handling, friendly  name instead of characterclasses for example. Do not show regexes?
//TODO: jquery xhr get

declare var exports : any;
declare var module: any;
declare var require: any;
declare var process : any;

module miniup {

	export class ParseFunction {
		ruleName : string;
		friendlyName : string;
		memoizationId: number;
		isTerminal = false;
		sequence : ISequenceItem[];
		autoParseWhitespace: boolean = undefined;
		disabled = {}; //TODO remove again?

		constructor(private asString: string, public parse : (parser: Parser) => any, opts? : Object) {
			if (opts)
				Util.extend(this, opts);
		}

		public toString(): string {
			return (this.ruleName ? this.ruleName + " = " : "") + this.asString;
		}
	}

	export interface ISequenceItem { label? : string; expr: ParseFunction; }
	export interface IOperatorDef { operator:ParseFunction; left:boolean; }

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
				{ isTerminal: true });
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
				{ isTerminal: true });
		}

		public static dot(): ParseFunction {
			return new ParseFunction(
				".",
				MatcherFactory.regexMatcher(/./),
				{ isTerminal: true });
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
			//TODO: throw error on lambda matches based on grammar setting
			return new ParseFunction(
				"(" + matcher.toString() + (separator ? " " +separator.toString() : "") + ")" + (atleastOne ? "+" : "*") + (separator ? "?" : ""),
				function (parser: Parser): any {
					var res = [];
					var item, sep = undefined;
					var p;

					do {
						//store separator from previos iteration
						if (sep !== undefined && storeSeparator)
							res.push(sep);

						p = parser.currentPos;
						item = parser.parse(matcher);

						//consumed nothing?
						if (item === undefined) {
							if (separator && sep !== undefined && sep !== null) //should not end with separator, unless sep is optional and didn't consume input
								return undefined;

							break; //we're done
						}

						//consumed something at least
						res.push(item);

						//TODO: fix everywhere, null indicates Parser.EMPTY, undefined indicates Parser.FAIL
						//but, bail out on matchin lambda items eternally (unless sep does not consume anything as well!)
						if (parser.currentPos == p && (!separator || sep === null))
							break; //or throw? -> throw new ParseException(parser, "Rule '" + this + "' can match just nothing an unlimited amount of times. Please fix the grammar. ")

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

		//TODO, empty label means only result? ex: '(' :res ')'
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

				function (parser: Parser): any {
					var start = parser.currentPos;
					var res = undefined;
					var isleftrecursive = false;
					var error: RecursionException;
					var recursingchoice : ParseFunction;
					var recursingpos: number;

					choices.some((choice, idx) => {
						try {
							return undefined !== (res = parser.parse(choice));
						}
						catch(e) {
							if (e instanceof RecursionException
								&& parser.allowLeftRecursion
								&& idx < choices.length -1 //recursion in the last choice cannot be solved
							) {
								isleftrecursive = true; //mark left recursive and try the net choice
								recursingchoice = choice;
								recursingpos = idx;
								error = <RecursionException> e;
								parser.log("> Detected recursion in " + e.func.toString() + " @ " + parser.currentPos)
								return true; //break the loop
							}
							else
								throw e;
						}
						return false;
					})

					if (!isleftrecursive)
						return res;

					// handle left recursion. Left recursion is parsed by using basically the follow on-the-fly refactoring of the grammar
					// LR: R = R a / b
					// Rewrites to RR:
					// R = b R2; R2= a R2 / lambda
					// R2 can be written as R2 = a*
					// So R can be rewritten as as
					// R = b (a)*
					// So first match b, then repeat the pattern R a, where R contains the memoized previous match

					//find seed. Given the failed choice, there should be another choice that matches!
					//A new choice matcher will be created, because recusion might occur in the remaining choice, which need their own state management
					var seedmatcher = MatcherFactory.choice.apply(MatcherFactory, choices.slice(1+recursingpos));
					parser.log("> searching seed with " + seedmatcher.toString() + " @ " + parser.currentPos)
					var seed = parser.parse(seedmatcher);
					var basepos = start; //input needs to consume during loop, to avoid endless list!

					if (seed === undefined) {
						parser.log("> found no seed to solve recursion")
						throw error;
					}

					parser.log("> found seed for recursion, growing on " + recursingchoice.memoizationId + " recur: " + error.func.memoizationId+ " seed: " + (seed.$text?seed.$text:seed));
					while(true) {
						parser.memoize(error.func, parser.currentPos, parser.currentPos, seed);

						if (seed !== undefined && parser.currentPos > basepos) {

							if (!parser.cleanAST && seed instanceof Object)
								Util.extend(seed, {
									$start : start,
									$text : parser.getInput().substring(start, parser.currentPos),
									$rule : seed.$rule || this.ruleName || ""
								})

							basepos = parser.currentPos;
							res = seed;
							seed = parser.parse(recursingchoice);
						}
						else
							break;
					}

					return res;
				}

			);
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

		public static lambda() : ParseFunction {
			return new ParseFunction(
				"",
				(parser: Parser): any => {
					return null;
				});
		}


		public static operators(ops:IOperatorDef[], operand: ParseFunction): ParseFunction {
			var base : ParseFunction;
			for(var i=0; i < ops.length; i++)
				base = MatcherFactory.singleOperator(ops[i], i == 0 ? operand : base)

			return new ParseFunction(
				["@operator", ops.map(op => (op.left?"left":"right" + op.operator)).join(" "), "on", operand.toString()].join(" "),
				(parser: Parser): any => {
					return parser.parse(base);
				}
			)
		}

		public static singleOperator(op: IOperatorDef, operand: ParseFunction): ParseFunction {
			function buildAST (items : any[]) {
				return items.length < 2 ? items[0] : {
					left : op.left ? buildAST(items.slice(0, -2)) : items[0],
					right: op.left ? items[items.length -1] : buildAST(items.slice(2)),
					op   : op.left ? items[items.length -2] : items[1]
				}
			}

			var listparser = MatcherFactory.list(operand, true, op.operator, true);

			return new ParseFunction(
				["@operator-" + (op.left?"left":"right"), op.operator, operand].join(' '),
				(parser: Parser): any => {
					var res = parser.parse(listparser);

					if (res === undefined)
						return undefined;

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
			return new Parser(this, input, opts).parseInput(MatcherFactory.call(opts.startSymbol || this.startSymbol));
		}

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
		allowLeftRecursion? : boolean;
	}

	export class Parser implements IParseArgs {
		debug: boolean = false;
		inputName: string = "input";
		input: string;
		cleanAST: boolean = false;
		extendedAST: boolean =false;
		allowLeftRecursion : boolean = true;

		private static nextMemoizationId = 1;
		private static RecursionDetected = { recursion : true };

		currentPos: number = 0;
		private memoizedParseFunctions = {}; //position-> parseFunction -> MemoizeResult
		private isParsingWhitespace = false;
		autoParseWhitespace = false;
		expected = []; //pos -> [ expecteditems ]
		private stackdepth = 0;

		constructor(public grammar: Grammar, input: string, opts: IParseArgs = {}) {
			this.input = "" + input;
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
						throw new ParseException(this, "Found superfluous input after parsing");
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
				this.stackdepth++;

				//consume whitespace
				if (!this.isParsingWhitespace && this.autoParseWhitespace)
					this.consumeWhitespace();

				//check memoization cache
				if (this.isMemoized(func)) {
					this.log(" /" + func.toString() + " ? (memo)");

					result = this.consumeMemoized(func);
					if (result == Parser.RecursionDetected) {
						this.log(" | (recursion detected)");
						result = undefined; //fix isMatch detection
//	TODO: needed?					delete this.memoizedParseFunctions[func.memoizationId][startpos]

						throw new RecursionException(this, func);
					}
				}

				else {
					this.log(" /" + func.toString() + " ?");
					this.memoize(func, startpos, startpos, Parser.RecursionDetected);

					//store expected
					if (func.isTerminal && !this.isParsingWhitespace) {
						if (!this.expected[this.currentPos])
							this.expected[this.currentPos] = [];
						this.expected[this.currentPos].push(func.friendlyName || func.ruleName || func.toString());
					}

					//finally... parse!
					try {
						result = func.parse(this);
					} finally {
						this.unmemoize(func, startpos); //TODO: still needed? for the case that parse threw. Make sure LR state is always removed. New state will be stored later on
					}

					//enrich result with match information
					if (!this.cleanAST && result instanceof Object && !result.$rule)
						Util.extend(result, { $start : startpos, $text : this.getInput().substring(startpos, this.currentPos), $rule : func.ruleName });

					//store memoization result
					this.memoize(func, startpos, this.currentPos, result);
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

				this.log(" \\" + func.toString() + (isMatch ? " V" : " X") + " @" + this.currentPos);
				this.stackdepth--;
			}
		}

		memoize(func: ParseFunction, startpos: number, endpos: number, result: any) {
			this.memoizedParseFunctions[func.memoizationId][startpos] = <MemoizeResult> {
				result: result,
				endPos: endpos
			};
		}

		//TODO: used?
		unmemoize(func: ParseFunction, startpos: number) {
			delete this.memoizedParseFunctions[func.memoizationId][startpos];
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
			this.isParsingWhitespace = true;
			this.parse(this.grammar.whitespaceMatcher);
			this.isParsingWhitespace = false;
		}

		log(msg: string) {
			if (this.debug && !this.isParsingWhitespace)
				Util.debug(Util.leftPad(msg, this.stackdepth, " |"));
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

	export class RecursionException extends ParseException {
		constructor(parser: Parser, public func: ParseFunction) {
			super(parser, "Grammar error: Left recursion found in rule '" + func.toString() + "'");
		}
	}

	export class GrammarReader {
		private static miniupGrammar: Grammar = null;

		public static getMiniupGrammar(): Grammar {
			if (GrammarReader.miniupGrammar === null)
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
			var ws      = g.addRule('whitespace', choice(call('WHITESPACECHARS'), call('MULTILINECOMMENT'), call('SINGLELINECOMMENT')));
			var identifier = call('IDENTIFIER');
			var regex   = g.addRule('regex', seq(si('text', call('REGEX'))));
			var dot     = g.addRule('dot', seq(si('dot', lit('.'))));
			var lambda  = g.addRule('lambda', seq(si('lambda', choice(lit("-"), lit("")))));

			var paren   = g.addRule('paren', seq(si(lit('(')), si('expr', call('expression')), si(lit(')'))));

			var callRule = g.addRule('call', seq(
			  si('name', identifier),
			  si(MatcherFactory.negativeLookAhead(seq(si(opt(str)), si(choice(lit('='),lit('<-'))))))));

			var importRule = g.addRule('import', seq(
			  si(lit('@import')),
			  si('grammar', identifier), //TODO: or string, in case of filename
			  si(lit('.')),
			  si('rule', identifier)));

			var primary = g.addRule('primary', choice(
			  callRule,
			  literal,
			  g.addRule('characters', seq(si('text', call('CHARACTERCLASS')), si("ignorecase", opt(lit("i"))))),
			  dot,
			  importRule,
			  paren));

			var repeated = g.addRule('repeated', choice(
			  seq(
			    si(lit('(')),
			    si('expr', call('expression')),
			    si('separator', opt(seq(si(lit(';')), si('expr', call('expression'))))),
			    si(lit(')')),
			    si('suffix', choice(lit('*'), lit('+')))
			  ),
			  seq(
			  	si('expr', primary),
			    si('suffix', choice(lit('+'), lit('*')))
			  ),
			  primary));

			var suffixed = g.addRule('suffixed', choice(seq(
			  si('expr', repeated),
			  si('suffix', choice(lit('?'), lit('#')))),
			  repeated));

			var prefixed = g.addRule('prefixed', choice(seq(
			  si('prefix', choice(lit('$'), lit('&'), lit('!'))),
			  si('expr', suffixed)),
			  suffixed));

			var labeled = g.addRule('labeled', choice(
			  seq(si('label', identifier), si(lit(':')), si('expr', choice(regex, prefixed))),
			  seq(si('expr', prefixed))));

			var sequence = g.addRule('sequence', f.list(labeled, true));

			var operators = g.addRule('operator', seq(
			  si('operators', f.list(seq(
			  	si('operator', prefixed),
			  	si('associativity', opt(f.regex(/@left|@right/))),
			  	si(lit('>'))
			  ), true)),
			  si('operand', prefixed)));

			var choicerule = g.addRule('choice', list(choice(regex, operators, sequence, lambda), true, lit('/')));

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
			var ast = GrammarReader.getMiniupGrammar().parse(this.input);
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
			switch (ast.$rule) {
				case "lambda":
					return f.lambda();
				case "dot":
					return f.dot();
				case "literal":
					return f.literal(RegExpUtil.unescapeQuotedString(ast.text), ast.ignorecase === "i");
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
					}
				case "repeated":
					var separator = ast.separator ? this.astToMatcher(ast.separator.expr) : null;
					var expr = this.astToMatcher(ast.expr);
					return f.list(expr, ast.suffix === "+" ? true: false, separator);
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
				case "operator":
					var operators: IOperatorDef[] = (<any[]>ast.operators).map(opdef => ({
						left: opdef.associativity == null || opdef.associativity == "@left",
						operator: this.astToMatcher(opdef.operator)
					}));

					return f.operators(operators, this.astToMatcher(ast.operand));
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

		//TODO: move to parser.log?
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
				.describe('l', 'Disable left recursion').alias('l', 'no-left-recursion')
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
						inputName : inputName,
						allowLeftRecursion : !argv.l
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

//fixme: still strugling with the typescript module export system. Lets work around..
(function(root) {
	if (typeof(exports) !== "undefined")
		for(var key in miniup)
			exports[key] = miniup[key];
})(this);

//root script?
if ((typeof (module ) !== "undefined" && !module.parent))
	miniup.CLI.main();