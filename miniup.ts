// Some global environment stuff we use..

declare var exports : any;
declare var module: any;
declare var require: any;
declare var process : any;

function miniup(grammar: string): miniup.Grammar;
function miniup(grammar: string, input?: string, opts?: miniup.IParseArgs):any;
function miniup(grammar: string, input?: string, opts?: miniup.IParseArgs):any {
	if (input === undefined)
		return miniup.Grammar.load(grammar);
	return miniup(grammar).parse(input, opts);
}
module miniup {

	//TODO: optimize by inlining
	var FAIL = undefined; //No match was found. Be aware to always use operators that do no type coersion with FAIL and NOTHING. So either '===' or '!=='!
	var NOTHING = null;   //A match was found, but it either didn't consume any input or didn't match anything that is relevant in the AST. So NOTHING is a successful match.
	var RECURSION = { recursion : true };


	export class ParseFunction {
		static nextMemoizationId = 0;

		ruleName : string;
		friendlyName : string;
		memoizationId: number;
		isTerminal = false;
		sequence : ISequenceItem[];

		constructor(private asString: string, public parse : (parser: Parser) => any, opts? : Object) {
			this.memoizationId = ++ParseFunction.nextMemoizationId;
			if (opts)
				Util.extend(this, opts);
		}

		public toString(): string {
			return this.ruleName ? this.ruleName : this.asString;
		}

		public toSource(): string {
			return (this.ruleName ? this.ruleName + " = " : "") + this.asString; //TODO: friendlyname and whitespace
		}
	}

	export interface ISequenceItem { label? : string; expr: ParseFunction; }
	export interface IOperatorDef { operator:ParseFunction; left:boolean; }

	export class MatcherFactory {

		//TODO: move down
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

		private static regexMatcher(regex: RegExp): (p:Parser) => any {
			var r = new RegExp("^" + regex.source, regex.ignoreCase ? "i" : "");
			return (parser: Parser) : any => {
				var match = parser.getRemainingInput().match(r); //TODO: optimize check if properly cached, since they are called so often!
				if (match) { //TODO: optimize !== null check
					parser.currentPos += match[0].length;
					return match[0];
				}
				return FAIL;
			}
		}

		public static regex(regex: RegExp): ParseFunction {
			return new ParseFunction(
				regex.toString(),
				MatcherFactory.regexMatcher(regex),
				{ isTerminal: true });
		}

		public static characterClass(characterClass: string, ignoreCase: boolean = false): ParseFunction {
			//TODO: do not use a regex at all!
			var re = new RegExp(characterClass, ignoreCase ? "i":"");
			return new ParseFunction(
				characterClass + (ignoreCase ? "i":""),
				p => {
					var c = p.input.charAt(p.currentPos);
					if (!re.test(c))
						return FAIL;
					p.currentPos ++;
					return c;
				},
				{ isTerminal: true });
		}

		private static wordChar = /\w/;

		public static literal(keyword: string, ignoreCase: boolean = false): ParseFunction {
			var length = keyword.length;
			var cmp = ignoreCase ? keyword.toLowerCase() : keyword;
			return new ParseFunction(
				"'" + keyword + "'",
				p => {
					var val = p.input.substr(p.currentPos, length)

					if (ignoreCase ? val.toLowerCase() == cmp : val == cmp) {
						p.currentPos += length;

						//fail if auto parse whitespace is enabled and we end in the middle of a word
						if (p.autoParseWhitespace === true
							&& MatcherFactory.wordChar.test(val.charAt(val.length -1))
							&& MatcherFactory.wordChar.test(p.input.charAt(p.currentPos)))
							return FAIL;

						return val;
					}
					return FAIL;
				},
				{ isTerminal: true, friendlyName : "'" + keyword + "'"});
		}

		public static dot(): ParseFunction {
			return new ParseFunction(
				".",
				p => {
					var c = p.input.charAt(p.currentPos);
					if (c=== '')
						return FAIL;
					p.currentPos++;
					return c;
				},
				{ isTerminal: true });
		}

		public static dollar(matcher: ParseFunction): ParseFunction {
			return new ParseFunction(
				"$" + matcher.toString(),
				p => {
					var start = p.currentPos;
					var res = p.parse(matcher);
					if (res !== FAIL) {
						var end = p.currentPos;
						return p.input.substring(start, end).trim(); //MWE: TODO: trim. Really?
					}
					return FAIL;
				});
		}

		public static whitespaceModifier(autoMatchWhitespace: boolean, expr: ParseFunction) {
			return new ParseFunction(
				autoMatchWhitespace ? "@whitespace-on" : "@whitespace-off",
					p => {
						var prevWhitespace = p.autoParseWhitespace;
						p.autoParseWhitespace = autoMatchWhitespace;
						var res = p.parse(expr);
						if (autoMatchWhitespace) //parse any remaining whitespace if needed
							p.consumeWhitespace();
						p.autoParseWhitespace = prevWhitespace;
						return res;
					}
				)
		}

		public static call(ruleName: string): ParseFunction {
			var rule;
			return new ParseFunction(ruleName, function (p: Parser) {
				rule = rule || p.grammar.rule(ruleName); //cache the rule

					//further speed up: calls are inlined after resolving them the first time. That should improve performance as it reduces
					//lookups. Note that this creates clones, so it assumes matchers have no internal state!
					//If inlining somehow cases grammar modifictions not to work, just disable (or make configurable) the next line:
					if (p.optimize)
						Util.extend(this, rule);

				return p.parse(rule);
			});
		}

		public static list(matcher: ParseFunction, atleastOne : boolean = false, separator : ParseFunction = null, storeSeparator : boolean = false): ParseFunction {
			//TODO: throw error on lambda matches based on grammar setting
			return new ParseFunction(
				"(" + matcher.toString() + (separator ? " " +separator.toString() : "") + ")" + (atleastOne ? "+" : "*") + (separator ? "?" : ""),
				function (parser: Parser): any {
					var res = [];
					var item, sep = FAIL;
					var p;
					var startpos = parser.currentPos;

					do {
						//store separator from previos iteration
						if (sep !== FAIL && storeSeparator === true)
							res.push(sep);

						p = parser.currentPos;
						item = parser.parse(matcher);

						//consumed nothing?
						if (item === FAIL) {
							if (separator && sep !== FAIL && sep !== NOTHING) //should not end with separator, unless sep is optional and didn't consume input
								return FAIL;

							break; //we're done
						}

						//consumed something at least..?
						res.push(item);

						//..but, bail out on matchin lambda items eternally (unless sep does not consume anything as well!)
						if (parser.currentPos === p && (!separator || sep === NOTHING))
							break; //or throw? -> throw new ParseException(parser, "Rule '" + this + "' can match just nothing an unlimited amount of times. Please fix the grammar. ")

					} while (item !== FAIL && (!separator || (sep = parser.parse(separator)) !== FAIL));

					return atleastOne && res.length === 0 ? FAIL : parser.enrich(res, this, startpos);
			});
		}

		public static optional(matcher: ParseFunction): ParseFunction {
			return new ParseFunction(matcher.toString() + "?", (parser: Parser): any => {
				var res = parser.parse(matcher);
				return res === FAIL ? NOTHING : res;
			});
		}

		public static sequenceItem(label: string, expr: ParseFunction): ISequenceItem;
		public static sequenceItem(expr: ParseFunction): ISequenceItem;
		public static sequenceItem(a, b?): ISequenceItem  {
			return { label: <string> (b ? a : undefined), expr: <ParseFunction> (b ? b : a)};
		}

		public static sequence(...items: ISequenceItem[]): ParseFunction {
			if (items.length === 1 && !items[0].label)
				return items[0].expr;
			var hasEmptyLabel = items.some(item => item.label === "")

			return new ParseFunction(
				"(" + items.map(i => (i.label ? i.label + ":" : i.label === "" ? "::" : "") + i.expr.toString()).join(" ") + ")",

				function (parser: Parser) {
					var startpos = parser.currentPos;
					var result ;
					var success = items.every(item => {
						var itemres = parser.parse(item.expr);
						if (item.label === "")
							result = itemres;
						else {
							if (result === undefined)
								result ={};
							if (item.label) //we are interested in the result
								result[item.label] = itemres;
							if (parser.extendedAST)
								result[-1 + ((<any>result).length = ((<any>result).length || 0) + 1)] = itemres;
						}
						return itemres !== FAIL;
					});

					return success  === true ? hasEmptyLabel === true ? result : parser.enrich(result, this, startpos) : FAIL;
				},
				{ sequence : items});
		}

		public static choice(...choices: ParseFunction[]): ParseFunction {
			if (choices.length === 1)
				return choices[0];

			return new ParseFunction(
				"(" + choices.map(x => x.toString()).join(" | ") + ")",

				function (parser: Parser): any {
					//todo optimize: diff implemetnation if left recursion is not supported?!
					var start = parser.currentPos;
					var res = FAIL;
					var isleftrecursive = false;
					var error: RecursionException;
					var recursingchoice : ParseFunction;
					var recursingpos: number;

					choices.some((choice, idx) => {
						try {
							return FAIL !== (res = parser.parse(choice));
						}
						catch(e) {
							if (e instanceof RecursionException
								&& parser.allowLeftRecursion
								&& idx < choices.length -1 //recursion in the last choice cannot be solved
							) {

								isleftrecursive = true; //mark left recursive and try the net choice
								recursingchoice = choice;
								recursingpos = idx; //TODO: not needed anymore
								error = <RecursionException> e;
								parser.log("> Detected recursion in " + e.func.toString() + " @ " + parser.currentPos) //TODO: improve LR logging
								return true; //break the loop
							}
							throw e;
						}
					})

					if (isleftrecursive === false)
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
					var seedmatcher = MatcherFactory.choice.apply(MatcherFactory, choices.slice(1+recursingpos)); //TODO: use choices.indexOf ..
					parser.log("> searching seed with " + seedmatcher.toString() + " @ " + parser.currentPos)
					var seed = parser.parse(seedmatcher);
					var basepos = start; //input needs to consume during loop, to avoid endless list!

					if (seed === FAIL) {
						parser.log("> found no seed to solve recursion")
						throw error;
					}

					parser.log("> found seed for recursion, growing on " + recursingchoice.memoizationId + " recur: " + error.func.memoizationId+ " seed: " + (seed.$text?seed.$text:seed));
					while(true) {
						var memo = parser.getMemoEntry(error.func, parser.currentPos);
						memo.endPos = parser.currentPos;
						memo.result = seed;

						if (seed !== FAIL && parser.currentPos > basepos) {

							if (!parser.cleanAST && seed instanceof Object)
								Util.extend(seed, {
									$start : start,
									$text : parser.input.substring(start, parser.currentPos),
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
				function (parser: Parser): any {
					var left : ISequenceItem[] = [].concat(items),
						startpos = parser.currentPos,
						l : number, res = {};
					do {
						l = left.length;
						for(var i = l -1; i >= 0; i--) {
							var item = parser.parse(left[i].expr);
							if (item !== FAIL) {
								if (left[i].label)
									res[left[i].label] = item;
								left.splice(i, 1);
							}
						}
					} while (left.length > 0 && l !== left.length)

					left.forEach(i => i.label && (res[i.label] = null)); //make sure each label is available in the result

					return parser.enrich(res, this, startpos); //set matcher always succeeds. It might just have matched nothing
				});
		}

		public static positiveLookAhead(predicate: ParseFunction): ParseFunction {
			return new ParseFunction("&" + predicate.toString(), (parser: Parser): any => {
				var prepos = parser.currentPos;
				//TODO: do *not* update best match while parsing predicates!
				var matches = FAIL !== parser.parse(predicate);
				parser.currentPos = prepos;//rewind
				return matches ? NOTHING : FAIL;
			});
		}

		public static negativeLookAhead(predicate: ParseFunction): ParseFunction {
/*			//TODO: mwe: i'm a bit puzzled, but not using the positiveLookAhead matcher appears to 5% slower! very weird
			return new ParseFunction("!" + predicate.toString(), (parser: Parser): any => {
				var prepos = parser.currentPos;
				//TODO: do *not* update best match while parsing predicates!
				//TODO: do not update best match while parsing whitespace either!
				var matches = FAIL !== parser.parse(predicate);
				parser.currentPos = prepos;//rewind
				return matches ? FAIL : NOTHING;
			});
*/
			var ppm = MatcherFactory.positiveLookAhead(predicate);
			return new ParseFunction("!" + predicate.toString(), (parser: Parser): any => {
				return parser.parse(ppm) === FAIL ? NOTHING : FAIL; //FAIL === no match. NOTHING === match, so invert.
			});
		}

		public static lambda() : ParseFunction {
			return new ParseFunction(
				"",
				(parser: Parser): any => {
					return NOTHING;
				});
		}


		public static operators(ops:IOperatorDef[], operand: ParseFunction): ParseFunction {
			var base : ParseFunction;
			for(var i=0; i < ops.length; i++)
				base = MatcherFactory.singleOperator(ops[i], i === 0 ? operand : base)

			return new ParseFunction(
				["@operator", ops.map(op => (op.left?"left":"right" + op.operator)).join(" "), "on", operand.toString()].join(" "),
				function (parser: Parser): any {
					return parser.parse(base);//TODO: enrich
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

					if (res === FAIL)
						return FAIL;

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

		public static load(grammarSource: string, inputName?: string): Grammar {
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
			if ("whitespace" === rule.ruleName)
				this.whitespaceMatcher = rule;
			if (!this.startSymbol)
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
		optimize? : boolean;
	}

	export class Parser implements IParseArgs {
		debug: boolean = false;
		inputName: string = "input";
		input: string;
		cleanAST: boolean = false;
		extendedAST: boolean =false;
		allowLeftRecursion : boolean = true;
		optimize : boolean = true;

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
		//TODO: support to use input from filename somewhere

		public getRemainingInput(): string {
			return this.input.substring(this.currentPos); //substring will share the original string so goes easy on the mem and cpu.
		}

		public getInput(): string { return this.input; }

		parseInput(func: ParseFunction) : any {
			var res = this.parse(func);
			if (res === FAIL) {
				if (this.expected.length >= this.input.length)
					throw new ParseException(this, "Unexpected end of input");
				throw new ParseException(this, "Failed to parse");
			}
			else {
				if (this.currentPos < this.input.length)
					throw new ParseException(this, "Failed to parse");
				return res;
			}
		}

		parse(func: ParseFunction): any {
			var startpos = this.currentPos,
				isMatch = false,
				result = FAIL;

				//check memoization cache
				var memo : MemoizeResult = this.getMemoEntry(func, startpos);

				if (memo.endPos !== -1) { //we have knowledge! //TODO: test with caching disabled!
					if (this.debug)
						this.log(" /" + func.toString() + " ? (memo)");

					result = memo.result;
					this.currentPos = memo.endPos;

					if (result === RECURSION) {
						this.log(" | (recursion detected)");
// TODO: not needed anymore						result = FAIL; //fix isMatch detection
//	TODO: needed?					delete this.memoizedParseFunctions[func.memoizationId][startpos]

						throw new RecursionException(this, func);
					}
				}

				else {
					if (this.debug)
						this.log(" /" + func.toString() + " ?");
					this.stackdepth++;

					memo.endPos = startpos;

					//consume whitespace
					if (this.autoParseWhitespace === true && this.isParsingWhitespace === false)
						this.consumeWhitespace();
					if (this.isParsingWhitespace === false)
						this.storeExpected(func);


					//finally... parse!
					try {
						result = func.parse(this);


						if (result === FAIL)
							this.currentPos = startpos; //rewind
						//Optimize: TODO: how to check this the fastest?
						else if (this.cleanAST === false && result !== null && !result.$rule && func.ruleName)
							result.$rule = func.ruleName;

						memo.endPos = this.currentPos;
						memo.result = result;

						if (this.isParsingWhitespace === false) //TODO: duplication
							this.unstoreExpected(func);
						this.stackdepth--;
					} catch(e) {
						if (this.isParsingWhitespace === false)
							this.unstoreExpected(func);
						this.stackdepth--;
						memo.endPos = -1; //this.unmemoize(func, startpos); //TODO: still needed? for the case that parse threw. Make sure LR state is always removed. New state will be stored later on
						throw e;
					}
				}

				if (this.debug)
					this.log(" \\" + func.toString() + (result !== FAIL ? " V" : " X") + " @" + this.currentPos);

				return result;
		}

		getMemoEntry(func: ParseFunction, startpos: number) {
			var base = this.memoizedParseFunctions[func.memoizationId];
			if (base === undefined)
				base = this.memoizedParseFunctions[func.memoizationId] = {};

			var res  = base[startpos];
			if (res === undefined)
				res = base[startpos] = { result: RECURSION, endPos : -1 }
			return res;
		}

		consumeWhitespace() {
			this.isParsingWhitespace = true;
			this.parse(this.grammar.whitespaceMatcher);
			this.isParsingWhitespace = false;
		}

		friendlyNames : { pos: number; name: string; }[] = [];

		storeExpected(func: ParseFunction) {

			var p = this.currentPos;
			var names = this.friendlyNames;

			if (this.isParsingWhitespace === false && func.friendlyName)
				names.push({ pos : p, name: func.friendlyName});

			if (func.isTerminal && !this.isParsingWhitespace) {
				if (!this.expected[p])
					this.expected[p] = [];
				//last resort is toString(), which is ugly for classes and regexes //TODO: optimize.. but slow?
				this.expected[p].push(func.friendlyName || names[names.length - 1] || func.toString());
			}
		}

		unstoreExpected(func: ParseFunction) {
			//TODO: optimize test with friendlynames disabled
			if (!this.isParsingWhitespace && func.friendlyName)
				this.friendlyNames.pop();
		}

		enrich(ast: any, func: ParseFunction, startpos: number) : any{
			if (this.cleanAST === false) {
				ast.$start = startpos;
				ast.$text = this.input.substring(startpos, this.currentPos);
//				ast.$rule = this.stack[this.stack.length -1];
			}
			return ast;
		}

		log(msg: string) {
			if (this.debug && !this.isParsingWhitespace)
				Util.debug(Util.leftPad(msg, this.stackdepth, " |"));
		}
	}

	export class Exception {
		constructor(public name: string, public message?: string){}
		public toString():string { return this.name + ": " + this.message }
	}

	export class ParseException extends Exception {
		public coords: TextCoords;
		public expected : string[] = [];

		constructor(parser: Parser, message: string) {
			super("miniup.ParseException");
			var pos = Math.max(parser.currentPos, parser.expected.length - 1);
			var endpos = pos;
			var expected : string[] = parser.expected[pos] ? parser.expected[pos] : [];

			//If some terminal, like a characterclass or regex failed,
			//but hasn't a nice descriptive name, we might fallback to giving the error at a position
			//where a friendly name was available and expected.
			//This makes sure that error messages can be displayed on token level instead of charachter level
			//in case of a complex token.

			//TODO: this code becomes probably easier if all items are in the name,pos format
			var nonPartialMatches : any[] = expected.filter(
				x => x instanceof Object
			).sort(
				(x,y) => x.pos - y.pos
			);

			//if friendly names are used, report the error on the position the friendly name starts
			if (nonPartialMatches.length) {
				pos = nonPartialMatches[0].pos;
				expected = nonPartialMatches.filter(x => x.pos === pos).map(x => x.name);
				if (parser.expected[pos])
					expected = expected.concat(parser.expected[pos].map(x => x instanceof Object ? x.name : x))
			}

			this.coords = Util.getCoords(parser.input, pos, endpos);

			this.expected = expected.sort().reverse().reduce((x, y) => { //Reverse because quoted terminals is nicer in front of non-terminal
				if (x[0] !== y)
					x.unshift(y); //reduce to non-unique items
				return x;
			}, [])

			this.message = Util.format("{1}({2},{3}): {0}\n{4}\n{5}\nExpected {6}",
				message,
				parser.inputName,
				this.coords.line, this.coords.col,
				this.coords.linetrimmed,
				this.coords.linehighlight,
				this.expected.length ? this.expected.join(" or ") : "<nothing>"
			);
		}

		public getColumn():number { return this.coords.col; }
		public getEndColumn(): number { return this.coords.col + this.coords.length; }
		public getLineNr():number { return this.coords.line;}
	}

	export class RecursionException extends ParseException {
		constructor(parser: Parser, public func: ParseFunction) {
			super(parser, "Grammar error: Left recursion found in rule '" + func.toString() + "'");
			this.name = "miniup.RecursionException";
		}
	}

	export class GrammarException extends Exception {
		constructor(public message: string) {
			super("miniup.GrammarException", message);
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
					g.addRule(key, Util.extend(MatcherFactory.regex(RegExpUtil[key]), { friendlyName : key.toLowerCase() }));
		}

		private static bootstrap(): Grammar {
			//TODO: use empty label where possible
			var g = new Grammar(), f = MatcherFactory;
			var seq = f.sequence, opt = f.optional, choice = f.choice, list = f.list, lit = f.literal, call = f.call, si = MatcherFactory.sequenceItem;
			GrammarReader.mixinDefaultRegexes(g);

			//rules
			var str     = g.addRule('string', choice(call('SINGLEQUOTESTRING'), call('DOUBLEQUOTESTRING')));
			var literal = g.addRule('literal', seq(si('text', str), si('ignorecase', opt(lit("i")))));
			var semanticaction = g.addRule('action', //lit('{'));
				seq(si(lit('{')), si(list(choice(f.characterClass("[^{}]"), call('action')))), si(lit('}'))));
			var ws      = g.addRule('whitespace', list(choice(call('WHITESPACECHARS'), call('MULTILINECOMMENT'), call('SINGLELINECOMMENT'), semanticaction)));
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
			  seq(si('nolabel', lit('::')), si('expr', choice(regex, prefixed))),
			  prefixed));

			var sequence = g.addRule('sequence', f.list(labeled, true));

			var operators = g.addRule('operator', seq(
			  si('operators', f.list(seq(
			  	si('operator', prefixed),
			  	si('associativity', opt(f.regex(/@left|@right/))),
			  	si(lit('>'))
			  ), true)),
			  si('operand', prefixed)));

			var whitespacemodifier = g.addRule('whitespacemodifier', choice(
			  seq(si('whitespaceflag', f.regex(/@whitespace-off|@whitespace-on/)), si('expr', sequence)),
			  sequence
			));

			var choicerule = g.addRule('choice', list(choice(regex, operators, whitespacemodifier, lambda), true, lit('/')));

			var expression = g.addRule('expression', choicerule);

			var rule = g.addRule('rule', seq(
			  si('name', identifier),
			  si('displayName', opt(str)),
			  si(choice(lit('='),lit('<-'))),
			  si('expr', expression),
			  si(opt(lit(';')))));

			g.addRule('grammar', f.whitespaceModifier(true, seq(si('rules', f.list(rule, true)))));
			g.startSymbol = "grammar";
			return g;
		}

		private requiredRules : Array<{ ast: any; name: string; }> = [];
		private allMatchers : Object = {}; //rulestring -> matcher
		private errors : { msg:string; ast:any; }[] =[];

		constructor(private input: string, private inputName: string = "grammar source"){}

		public build(): Grammar {
			var ast;

			Util.timeReport("Start building grammar");
			try {
				ast = GrammarReader.getMiniupGrammar().parse(this.input);
			}
			catch(e) {
				if (e instanceof ParseException)
					throw new GrammarException(e.message)
				throw e;
			}
			Util.timeReport("Parsed grammar");

			var g = new Grammar();

			(<any[]>ast.rules).forEach((ast: any) => {
				var r = this.astToMatcher(ast.expr);
				if (ast.displayName)
					r.friendlyName = RegExpUtil.unescapeQuotedString(ast.displayName);
				g.addRule(ast.name, r);
			});

			//auto load default tokens. Do not do this up front, since the first declared rules is the start symbol
			GrammarReader.mixinDefaultRegexes(g);

			if (!g.hasRule("whitespace"))
				g.addRule("whitespace", MatcherFactory.call("WHITESPACECHARS"));
			Util.timeReport("Built grammar");

			this.consistencyCheck(g);
			Util.timeReport("Checked grammar");

			return g;
		}

		consistencyCheck(g: Grammar) {
			//check required rules
			this.requiredRules.forEach(req => {
				if (!g.hasRule(req.name))
					this.errors.push({ msg: "Undefined rule: '" + req.name + "'", ast: req.ast })
			});

			if (this.errors.length > 0)
				throw new GrammarException(this.errors.map(e => {
					var coords = Util.getCoords(this.input, e.ast.$start)
					return Util.format("Invalid grammar: at {0} ({1},{2}): {3}", this.inputName, coords.line, coords.col, e.msg)
				}).join("\n"));
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
					return f.characterClass(ast.text, ast.ignorecase === "i");
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
								//return null; //hmmm //TODO: remove
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
					if (ast.some(x => x.label) && ast.some(x => x.nolabel))
						this.errors.push({ ast: ast, msg: "A default label ('::') is not allowed in a sequence where normal labels are used"})

					return f.sequence.apply(f, ast.map(item => f.sequenceItem(
						item.label ? item.label : item.nolabel ? "" : undefined,
						this.astToMatcher(item.label || item.nolabel ? item.expr : item)
					)));
				case "expression":
					return f.choice.apply(f, ast.map(this.astToMatcher, this));
				case "import":
					return f.importMatcher(ast.grammar, ast.rule);
				case "operator":
					var operators: IOperatorDef[] = (<any[]>ast.operators).map(opdef => ({
						left: opdef.associativity === null || opdef.associativity === "@left",
						operator: this.astToMatcher(opdef.operator)
					}));

					return f.operators(operators, this.astToMatcher(ast.operand));
				case "whitespacemodifier":
					return f.whitespaceModifier(ast.whitespaceflag === '@whitespace-on', this.astToMatcher(ast.expr));
				default:
					throw new Error("Unimplemented ruletype in: " + JSON.stringify(ast));
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
		public static CHARACTERCLASS = /\[([^\\\]]|(\\.))*\]/;
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
		length: number; //number of highlighted characters
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

		public static getCoords(input: string, pos: number, endpos? : number): TextCoords {
			var lines = input.substring(0, pos).split(RegExpUtil.LINEENDCHAR);
			var curline = input.split(RegExpUtil.LINEENDCHAR)[lines.length -1];
			lines.pop(); //remove curline
			var col = pos - lines.join().length;
			endpos = isNaN(endpos) ? pos : Math.max(pos, endpos);
			var length = Math.max(1, endpos - pos +1)

			return {
				line : lines.length + 1,
				col : col + 1, //do not use zero-indexes in messages
				length: length,
				linetext : curline,
				linetrimmed: curline.replace(/\t/," "), //trim and replace tabs
				linehighlight : Util.leftPad(Util.leftPad("", length, "^"), col , "-") //correct padding for trimmed whitespacse
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


		private static start : number = +(new Date());
		public static enableTimeReport: boolean  = false;
		public static timeReport(msg: string) {
			if (Util.enableTimeReport)
				console.log(Util.format("[+{0}] {1}", (+new Date()) - Util.start, msg))
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
				.describe('O', 'No grammar optimizations').alias('O', 'no-optimization')
				.describe('r', 'Print a parse report insteadof generation output').alias('r', 'report')
				.boolean('rvcehOr'.split(''))
				.string("giso".split(''))

			//help
			var argv = optimist.argv, args = argv._, grammar: Grammar;
			var inputName = "input";

			if (argv.h) {
				optimist.showHelp();
				process.exit(0);
			}
			else if (argv.r) {
				Util.enableTimeReport = true;
				Util.timeReport("Started parser");
			}

			function handleException(e) {
				if (e instanceof miniup.Exception) {
					console.error(e.toString());
					process.exit(1);
				}
				else
					throw e;
			}

			function processInput (input: string) {
				try {
					//parse
					var res = grammar.parse(input, {
						debug: argv.v,
						cleanAST: argv.c,
						extendedAST: argv.e,
						inputName : inputName,
						allowLeftRecursion : !argv.l,
						optimize : !argv.O
					});

					//store
					if (argv.o)
						CLI.writeStringToFile(argv.o, JSON.stringify(res))
					else if (!argv.r)
						console.log(JSON.stringify(res, null, 2));

					Util.timeReport("Done " + (res === FAIL ? "(Parse failed)" : "(Parse success)"));
				}
				catch (e) {
					handleException(e);
				}
			}

			//get the grammar
			try {
				if (argv.s)
					grammar = Grammar.loadFromFile(argv.s)
				else if (argv.g)
					grammar = miniup.Grammar.load(argv.g, "input")
				else
					grammar = miniup.GrammarReader.getMiniupGrammar();
			}
			catch (e) {
				handleException(e);
			}
			Util.timeReport("Obtained grammar");


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
//export = miniup;
(function(root) {
	if (typeof(module) !== "undefined" && typeof(exports) !== "undefined")
		module.exports = miniup;
})(this);

//root script?
if ((typeof (module ) !== "undefined" && !module.parent))
	miniup.CLI.main();