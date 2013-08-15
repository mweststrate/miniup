module miniup {
	
	export class ParseFunction {
		private static pfCounter = 0;

		public id = ++ParseFunction.pfCounter;
		public ruleName: string;
		public astName: string;

		parse(parser: Parser): any {
			throw "ParseFunction.parse is an abstract method";
		}
	}

	export class SequenceMatcher extends ParseFunction {
		constructor(public items: SequenceMatcher[]) {
			super();

		}

		parse(parser: Parser): any {
			var success = true;

			var result = {};
			if (this.ruleName)
				result['type'] = this.ruleName;

			this.items.forEach(item => {
				var res = parser.parse(item);
				if (!item)
					success = false;
				else if (item.astName)
					result[item.astName] = res;
			});

		}
	}

	export class Rule extends SequenceMatcher {

		constructor(ruleName: string, items: SequenceMatcher[]) {
			super(items);
			this.ruleName = ruleName;
		}
	}

	export class Grammar {

		private rules = {};
		public startSymbol: string;

		public static load(grammarSource: string): Grammar {
			//TODO:

			return null;
		}

		registerParseRule(ruleName: string, func: Rule) {
			if (this.rules[ruleName])
				throw new Error("Rule '" + ruleName + "' is already defined");
			this.rules[ruleName] = func;
		}

		public rule(ruleName: string): Rule {
			if (!this.rules[ruleName])
				throw new Error("Rule '" + ruleName + "' is not defined");
			return this.rules[ruleName]
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

	export class Parser {

		currentPos: number = -1;
		maxPos: number = -1;
		memoizedParseFunctions = {};

		constructor(public grammar: Grammar, public input: String) {

		}

		public parse(func: ParseFunction): any {
			if (this.isMemoized(func))
				return this.consumeMemoized(func);

			var startpos = this.currentPos;
			var result = func.parse(this);

			//TODO: result max end pos and such

			if (!result)
				this.currentPos = startpos; //reset


			this.memoizedParseFunctions[func.id][startpos] = {
				result: result,
				endpos : this.currentPos
			}
			return result;
		}

		isMemoized(func: ParseFunction): bool {
			if (!this.memoizedParseFunctions[func.id]) {
				this.memoizedParseFunctions[func.id] = {};
				return false;
			}
			return this.memoizedParseFunctions[func.id][this.currentPos] !== undefined;
		}

		consumeMemoized(func: ParseFunction): any {
			var currentPos = this.currentPos;
			this.currentPos = this.memoizedParseFunctions[func.id][currentPos].endpos;
			return this.memoizedParseFunctions[func.id][currentPos].result;
		}
	}

	export class ParseException {

	}
}