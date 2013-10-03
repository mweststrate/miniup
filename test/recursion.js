R = R a / b

R = b X
X = a X / -

---

R = left:R right:a  /  b

R = b X --> after match X, if X then X.left = b else b;

X = a X --> { right: a, left : X }
X = - --> null


R → Ra
|b
can be translated to the right-recursive:
R →bX
R →aX
|ε



in parser.parse:

				//TODO: get memoize record. If state is 'running', bail out: left recursion

				//TODO: left recursion support = do not if the rule is running, but has alternatives left!
				//rules that have alternatives on recursion should catch recursion exception and move on
				//to the next state? (n.b. make sure that this parse method handles stack unwind properly in a finally block)

				//if state is 'known' return memoized result
				//if state is 'new' continue, set state to 'running'


public static choiceMatcher(choices: ParseFunction[]): ParseFunction {
			return (parser: Parser): any => {
				var start = parser.currentPos;
				var seed, seedChoice;
				var isLeftRecursive = false;

				var match = choices.some(choice => {
					try {
						var r = parser.parse(choice);
						if (r !== undefined) {
							seed = r;
							seedChoice = choice;
							return true;
						}
					}
					catch(recursion /*TODO*/) { //TODO: are recursion exceptions allowed in the last choice?
						isLeftRecursive = true;
					}
					return false;
				}

				if (!match && !isLeftRecursive)
					return undefined;
				else if (!match && isLeftRecursive) {
					if (recursion.cause == arguments.callee)
						return undefined;  //we're done, no match.
					throw recursion; //rethrow for indirect left recursion support
				}
				if (match && !isLeftRecursive)
					return seed;

				else { //handle left recursion
					var res = seed;
					var foundNew = false;

					do {
						choices.every(choice => {
							//if the choice was the terminating seed choice, we're done
							if (choice == seedChoice)
								return false;

							//memo best match till now
							parser.memo(start, arguments.callee /* self ref to parser function */, seed);
							parser.startPos = start; //unwind

							try {
								var r = parser.parse(choice);

								//left recursive call succeeded. Store result and set up for another round
								if (r !== undefined) {
									res = r;
									foundNew = true;
									parser.memo(start, arguments.callee, r); //memoize the new match
									return false; //this iteration done
								}
							}
							catch(recursion /*TODO*/ ) {
								//try next
							}
							return true;
						})
					} while(foundNew)

					return res;
				}
			}
		}


//variant 2

parse
	recursion? throw recursion detected

parse
	caught recursion detected?
		register recursion
		fail (do not memoize)
		do not register fail

parse
	success?
	reattempt recursive matches

reattempt recursive matches
	for funcs in recursive set //will repeat forever until no successful match
		try parse

//direct
A = A b / b
b = 'b'


//indirect
A = B x | x
B = A y | y


//left, priorized
A = A '+' B | B
B = 7

//right, priorized
A = B '+' A | B
B = 7

//generic, (left?)
A = A '+' A | '7'

A = MUL | ADD | '7'
MUL = A '*' A
ADD = A '+' A

//left bound priorized infix op
A = A '+'< A | '7'

//right bound priorized infix op
A = A '+'> A | '7'

//other exampel
Value   ← [0-9.]+ | '(' Expr ')'
Product ← Expr (('*' | '/') Expr)*
Sum     ← Expr (('+' | '-') Expr)*
Expr    ← Product | Sum | Value

//impossible
S ← 'x' S 'x' | 'x