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

	export class RuleFactory {

		//TODO: any (.) matcher
		//TODO: $ matcher (what does it mean?)
		public static createRegexMatcher(regex: string, ignoreCase: bool = false): ParseFunction {
			var r = new RegExp("\\A" + regex, ignoreCase ? "i" : "");

			return (parser: Parser): any => {
				var remainingInput = parser.getRemainingInput();
				var match = remainingInput.match(r);
				if (match) {
					parser.currentPos += match[0].length;
					return match[0];
				}
				return undefined;
			}
		}

		public static createCharacterMatcher(regex: string, ignoreCase: bool = false): ParseFunction {
			return createRegexMatcher(regex, ignoreCase);
		}

		public static createKeywordMatcher(keyword: string, ignoreCase: bool = false): ParseFunction {
			var rem = createRegexMatcher("\\A" + Util.quoteRegExp(keyword), ignoreCase);
			return Util.extend((parser: Parser): any => {
				parser.consumeWhitespace();
				var res = parser.parse(rem);
				parser.consumeWhitespace();
				return res;
			}, {
				isKeywordMatcher: true
			});
		}

		public static createRuleMatcher(ruleName: string): ParseFunction {
			return (parser: Parser): any => {
				return Util.extend(parser.parse(parser.grammar.rule(ruleName)), { ruleName: ruleName });
				//TODO: automatically set rulename property?
			}
		}

		public static createZeroOrMoreMatcher(matcher: ParseFunction): ParseFunction {
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

		public static createOneOrMoreMatcher(matcher: ParseFunction): ParseFunction {
			var zmm = createZeroOrMoreMatcher(matcher);

			return (parser: Parser): any => {
				var res = parser.parse(zmm);
				return res.length > 0 ? res : undefined;
			}
		}

		public static createZeroOrOneMatcher(matcher: ParseFunction): ParseFunction {
			return (parser: Parser): any => {
				var res = parser.parse(matcher);
				return res === undefined ? null : res;
			}
		}

		public static createSequenceMatcher(items: ParseFunction[]): ParseFunction {
			if (items.length == 1) //Not a real sequence
				return items[0];

			return (parser: Parser): any => {
				var result = [];

				var success = items.every(item => {
					var itemres = parser.parse(item);
					if (itemres === undefined)
						return false;

					if (item.isKeywordMatcher && !item.friendlyName && items.length > 1)
						return true; //ignore result if it is just a stringmathcer without astname. Keywords are not interesting in an AST

					result.push(itemres);
					if (item.astName)
						result[item.astName] = itemres;

					return true;
				});

				return success ? result.length == 1 ? result[0] : result : undefined;
			}
		}

		public static createChoiceMatcher(choices: ParseFunction[]): ParseFunction {
			return (parser: Parser): any => {
				var res;

				if (choices.some(choice => undefined !== (res = parser.parse(choice))))
					return res;
				return undefined;
			}
		}

		public static createPositivePredicateMatcherMatcher(predicate: ParseFunction): ParseFunction {
			return (parser: Parser): any => {
				var prepos = parser.currentPos;
				//TODO: do *not* update best match while parsing predicates!
				var matches = undefined !== parser.parse(predicate);
				parser.currentPos = prepos;//rewind
				return matches ? null : undefined;
			}
		}

		public static createNegativePredicateMatcherMatcher(predicate: ParseFunction): ParseFunction {
			var ppm = createPositivePredicateMatcherMatcher(predicate);
			return (parser: Parser): any => {
				return parser.parse(ppm) === undefined ? null : undefined; //undefined == no match. null == match, so invert. 
			}
		}

		public static createNamedRule(matcher: ParseFunction, names: NamedRule) {
			return Util.extend(matcher, names);
		}

	}

	export class Grammar {

		private rules = {};
		whitespaceMatcher: ParseFunction;
		public startSymbol: string;

		public static load(grammarSource: string): Grammar {
			//TODO:

			return null;
		}

		registerParseRule(rule: ParseFunction) {
			if (!rule.ruleName)
				throw new Error("Anonymous rules cannot be registered in a grammar. ");
			if (this.rules[rule.ruleName])
				throw new Error("Rule '" + rule.ruleName + "' is already defined");
			if ("whitespace" == rule.ruleName)
				this.whitespaceMatcher = rule;

			this.rules[rule.ruleName] = rule;
		}

		public rule(ruleName: string): ParseFunction {
			if (!this.rules[ruleName])
				throw new Error("Rule '" + ruleName + "' is not defined");
			return this.rules[ruleName];
		}

		public parse(input: string, startSymbol?: string): any {
			var result = new Parser(this, input).parse(this.rule(startSymbol || this.startSymbol));
			if (!result) {
				//TODO: error handling in the case of null result
				throw new ParseException();
			}
			return result;
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
		private stack: StackItem[] = [];

		constructor(public grammar: Grammar, public input: String) {

		}

		public getRemainingInput(): string {
			return this.input.substring(this.currentPos);
		}

		public parse(func: ParseFunction): any {
			try {
				this.stack.push({
					func: func,
					startPos: this.currentPos
				});

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

	}

	export class Util {
		public static quoteRegExp(str: string): string {
			return (str + '').replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
		}

		public static extend(thing: any, extendWith: Object): any {
			for (var key in extendWith)
				thing[key] = extendWith[key];
			return thing;
		}
	}
}