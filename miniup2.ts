module miniup {
	
	export interface ParseFunction {
		memoizationId: number;
		ruleName: string;
		astName: string;

		(parser: Parser): any;
	}

	export class RuleFactory {

		createSequenceMatcher(items: ParseFunction[], ruleName? : string): ParseFunction {
			return <any> (parser: Parser): any => {
				var result = [];
				if (ruleName)
					result['type'] = ruleName;

				var success = items.every(item => {
					var itemres = parser.parse(item);
					if (itemres === undefined)
						return false;

					result.push(itemres);
					if (item.astName)
						result[item.astName] = itemres;

					return true;
				});

				return success ? result : undefined;
			}
		}
	}

	export class Grammar {

		private rules = {};
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

		currentPos: number = -1;
		maxPos: number = -1;
		memoizedParseFunctions = {};
		private stack: StackItem[] = [];

		constructor(public grammar: Grammar, public input: String) {

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
				var result = func(this);

				//TODO: result max end pos and such

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
	}

	export class ParseException {

	}
}