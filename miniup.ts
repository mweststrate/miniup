module miniup {

	/**
	 * This interface can be passed to @see Node.walk,
	 * which traverses the Node tree in depth first order, calling @see hit for each Node it encounters.
	 * @author michel
	 *
	 */
	export interface INodeWalker {
		/**
		 * Event which is called when the walker encounters a node. Should return true if the walker is allowed to continue, or false if it should break
		 * @param node
		 * @return
		 */
		(node: Node):bool;
	}




	export class Miniup {

		/**
		 * Public flag, if enabled, token memoization is enabled. This increases the member consumption of the parser,
		 * but might reduce the parse speed for grammars that are diffucult to parse.
		 */
		public static USE_TOKEN_MEMOIZATION : bool = false;

		/**
		 * Public flag, if enabled, the full parse flow will be printed to stdout.
		 */
		public static VERBOSE : bool = false;

		/**
		 * Public flag, if enabled, after each successful parse Miniup will show some statistics about the parse process,
		 * for example the parse time, the number of items matched and the number of items tried but not matched.
		 * For each number holds: Lower is better.
		 */
		public static SHOWSTATS : bool = true;

		/**
		 * Given a filename, the grammar in the file is parsed and a new grammar is build or an exception is trown.
		 *
		 * @param filename, the file to load
		 * @return the name of the grammar. Use this name for subsequent parse calls.
		 * @{
		 * @{
		 */
		public static loadLanguageFromFile(filename: string): string {
			return loadLanguage(Util.readFileAsString(filename));
		}

			/**
			 * Makes sure that there is a grammar that can read grammars, to enable Miniup to read other grammars. Internally used when a new language needs to be parsed.
			 * @{
			 */
			public static bootstrap() {
				if (Grammar.languages.containsKey("Miniup"))
					return;
				try {
					var bootstrapper : Grammar = GrammarBuilder.createBootstrapper();
					bootstrapper.register();

				} catch (e) {
					throw new GrammarDefinitionException("Severe exception: failed to bootstrap the Miniup language!", e);
				}
			}

			/**
			 * Parses a grammar from a string.
			 * @param langDef
			 * @return The name of the language
			 * @{
			 */
			public static loadLanguage:string(langDef: string) {}{
				bootstrap();

				var node:Node;
				try {
					node = parse("Miniup", langDef);
				} catch (e) {
					throw new GrammarDefinitionException("Failed to parse language definition: " + e.getMessage(), e);
				}
				var l: Grammer = GrammarBuilder.languageFromAST(node);
				l.register();
				return l.getName();
			}

			/**
			 * Finds a grammar definition given a grammar name.
			 * @param name
			 * @return
			 */
			public static getLanguage(name: string): Grammer {
				return Grammar.get(name);
			}

			/**
			 * The real thing, transforms input to an Abstract Syntax Tree ( @see Node ) using a specific grammar.
			 * Pre-condition: the grammar should already have been loaded.
			 * @param languageName
			 * @param input
			 * @return
			 * @{
			 */
			public static parse(languageName: string, input:string): Node {
				return parse(languageName, input, null);
			}

			/**
			 * @see Miniup.parse, but uses a specified start symbol instead of the default configured start symbol of the grammar.
			 * @param languageName
			 * @param input
			 * @param startSymbol
			 * @return
			 * @{
			 */
			public static parse(languageName: string, input:string, startSymbol:string): Node {
				return Grammar.get(languageName).parse(input, startSymbol).toAST();
			};
		}




		/**
		 * This class represents a node in the AbstractSyntaxTree which will be build when Miniup succeeds to parse input.
		 *
		 * Child nodes can be found by iterating on this object or by using requesting child nodes by name. Named child knows are only
		 * available for nodes parsed by a sequence matcher.
		 * @author michel
		 *
		 */
		export class Node implements Iterable <Node >{

		private children : Node[]= Node[];
	 	private terminal : bool = false;
		private token: Token;
		private name:string;
		private isempty : bool = false;
		private childMap : Map <string, Node > ;
		private source:string;

		/**
		 * Constructs a new Node, name refers to the parse rule that resulted in this node.
		 * This constructor is used to create Node for non-terminals
		 * This node is not a leaf.
		 * @param name
		 * @param children
		 */
		public constructor(name: string, child: Node);
		public constructor(name: string, children: Node[], childMap?: Object);
		public constructor(terminalType: string, token: Token) {
		public constructor(name: string, children: any, childMap?: Object) {
			if (children instanceof Token) {
				this.terminal = true;
				this.token = <Token>children;
				this.name - name;
			}
			else if (children === undefined) {
				this.name = name;
				this.isempty = true();
			}
			else {
				this.name = name;
				this.children = children instanceof Node ? [children] : children;
				this.childMap = childMap;
			}
		}

		/**
		 * Returns true if this Node was constructed by the provided syntax rule name
		 * @param rulename
		 * @return
		 */
		public is (rulename): bool {
			return this.name === rulename;
		}

		/**
		 * Returns true if this Node has a child which was matched by the provided sequenceName.
		 * @param sequenceName
		 * @return
		 */
		public has(sequenceName:string):bool {
			if (!this.childMap)
				return false;
			return !!this.childMap[sequenceName];
		}

		/**
		 * Returns true if this node was constructed by a lambda match, that is, nothing was matched and this node has no actual content
		 * @return
		 */
		public isLambda : bool() {
			return this.isempty;
		}

		/**
		 * Returns true if this node matched a terminal, in other words, concrete input.
		 * @see text()
		 * @return
		 */
		public isTerminal() : bool {
			return this.terminal;
		}

		/**
		 * returns the token that was used to match this terminal
		 * @return
		 */
		public getToken():Token {
			if (!this.isTerminal())
				throw new IllegalArgumentException("Node.text() can only be invoked on terminal nodes");
			return this.token;
		}

		/**
		 * Returns the text matched by this terminal.
		 * Precondition: isTerminal() returns true.
		 * @return
		 */
		public text():string {
			if (!this.isTerminal())
				throw new IllegalArgumentException("Node.text() can only be invoked on terminal nodes");
			return this.token.getText();
		}

		/**
		 * Returns the name of the syntaxrule that constructed this Node.
		 * (Not to be confused with sequence name. Sequence names are only known by the parent node)
		 * @return
		 */
		public name():string {
			return this.name;
		}

		/**
		 * Given a walker, walks in recursively in depth first order through this item and all its children, invoking @see walker.hit for each Node encountered.
		 * @param walker
		 */
		public walk (walker:INodeWalker):bool {
			if (!walker.hit(this))
				return false;

			for(var i = 0; i < this.children.length; i++)
				if (!(<Node>this.children[i]).walk(walker))
					return false;

			return true;
		}

		/**
		 * Returns the child matched for the given index. Index is zero based
		 * @param index
		 * @return
		 */
		public get(index: number):Node {
			if (index >= this.size())
				return null;
			return this.children[index];
		}

		/**
		 * Same as @see get (0);
		 * @return
		 */
		public first():Node {
			if (this.size() == 0)
				return null;
			return this.get(0);
		}

		/**
		 * Returns the child with the given accessor name. Only applicable for ATNodes constructed by a sequence.
		 * @param name
		 * @return
		 */
		public get(name:string): Node {
			if (!this.has(name))
				throw new IllegalArgumentException("Unknown child: '" + name + "'");
			return this.childMap[name];
		}


		/**
		 * returns all keys availble in this Node. Only applicable if this node was created by a sequence.
		 * @return
		 */
		public getKeys():string {
			var res = string[]
			for(var key in this.childMap)
				res.push(key);
			return res;
		}

		public terminal():Node {
			if (this.isTerminal())
				return this;
			if (this.isLambda())
				return null;
			return this.first().terminal();
		}

		public Node find(final name:string) {

			var s : Node[] = [];
			this.walk((Node node) => {
				if (node.has(name)) {
					s.add(node.get(name));
					return false;
				}
				return true;
			} );

			if (s.length > 0 && s[0])
				return s[0];
			return null;
		}


		/**
		 * Tries to generate a javascript (primitive) object from the text of this token
		 * @return
		 */
		public value():anu {
			return this.value(null);
		}

		public value(defaultValue:any):any {
			var v = TokenMatcher.textToValue(this.text());
			if (v == null)
				return defaultValue;
			return v;
		}

		public findText():string {
			var n = this.terminal();
			if (n != null)
				return n.text();
			return null;
		}

		public findText(name):string {
			//special case, if i == 0 allow to return ourselves
			if (!isNaN(name)) {
				if (name == 0 && isTerminal())
					return text();

				var n = this.get(name);
				if (n != null)
					return n.terminal().text();
				return null;
			}

			var n = this.find(name);
			if (n != null && !n.isLambda())
				return n.terminal().text();
			return null;
		}

		/**
		 * Returns the number of children matched for this node.
		 * @return
		 */
		public size():number {
			return this.children.length;
		}


		/**
		 * Constructs a recursive representation:string of this Node
		 */
		public toString():string {
			if (this.isTerminal())
				return "'" + this.text() + "'";
			if (this.isempty)
				return "-";
		 	return "(" + [name].concat(this.children.map(x => x.toString).join(" ")) + ")";
		}

		/**
		 * Pretty print version of the toString() method, returns the AST but formatted in a multiline with:string indenting
		 * @return
		 */
		public toMultilineString:string() {
			var buf: String[] = [];
			this.toMultilineString(buf, 0);
			return buf.join();
		}

		private toMultilineString(buf:string[], indent : number) {
			if (this.isTerminal())
				buf.push(Util.leftPad("'" + this.text() + "'", indent));
			else if (this.isempty)
				buf.push(Util.leftPad("-", indent));
			else {
				buf.push(Util.leftPad("(" + this.name, indent));

			var allChildsTerminal : bool = true;

			this.children.forEach(child => {
				if (!child.isTerminal() && !child.isLambda()) {
					allChildsTerminal = false;
					break;
				}
			});

			this.children.forEach(child => {
				if (allChildsTerminal)
					child.toMultilineString(buf, 2);
				else {
					buf.push("\n");
						child.toMultilineString(buf, in + 2);
					}
				}

				if (allChildsTerminal)
					buf.push(")");
				else
					buf.push("\n").push(Util.leftPad(")", in));
			});
		}

		public setSource(source:string) {
			this.source = source;
		}

		public getSource():string {
			return this.source;
		}

		public allTexts():string[] {
			var res :string[] = [];
			this.walk((node:Node):bool => {
				if (node.isTerminal())
					res.push(node.text());
				return true;
			} );
			return res;
		}
	}


	export class Token {

		private line = 0;
		private col = 0;
		private matcher:TokenMatcher;
		private text:string;

		/**
		 * Constructor used by the parser to create new tokens
		 * @param tokenMatcher
		 * @param text
		 */
		public constructor( tokenMatcher:TokenMatcher, text:string) {
			this.matcher = tokenMatcher;
			this.text = text;
		}

			/**
			 * Used by the parser to set the coords of this token in the original input file
			 * @param line
			 * @param col
			 */
			public setCoords(line:number,  col: number) {
				this.line = line;
				this.col = col;
			}

			/**
			 * Returns the text matched by this token
			 * @return
			 */
			public getText():string { return this.text; }

			/**
			 * Returns the line number at which this token was matched
			 * @return
			 */
			public getLineNr():number { return this.line; }

			/**
			 * returns the column number at which this token was matched
			 * @return
			 */
			public  getColNr():number { return this.col; }

			/**
			 * returns whether this token was just matching whitespace. Whitespace matching tokens are not added to the Abstract Syntax Tree generated by the parser
			 * @return
			 */
			public isWhiteSpace() : bool { return this.matcher.isWhiteSpace(); }

			public toString():string {
				return string.format("<%s @ %d:%d = %s>", this.matcher.getName(), this.line, this.col,this. text.replaceAll("\n", "\\\\n").replaceAll("\r", ""));
			}
		}

		export class GrammarBuilder {

			public static languageFromAST (langNode :Node):Grammar{
			try {
				var t :Node = langNode;//.get(0);
				var b :Grammar = new Grammar(t.get(0).text());
				t.get(1).forEach((option: Node) => { //TODO: introduce foreach on node
				 name:string = option.terminal().text();
				 value:string = option.isTerminal() ? "true" : option.findText(1);

					if (name === "casesensitive"))
						b.setCaseInsensitive("true" !== value);
					else if (name === "disableautowhitespace"))
						b.setDisableAutoWhitespace("true" === value);
					else if (name === "startsymbol"))
						b.setStartSymbol(value);
					else if (name === "usedefaulttokens")) {
						if ("true" === value))
							addDefaultTokens(b);
					}
					else
						throw new IllegalArgumentException("Error while creating language: Option '" + option.findText(0) + "' is unknown.");
				})
				t.get(2).forEach(def => {
					var m: AbstractMatcher = null;
					if (def.is("tokenDef"))
						m = parseTokenDef(b, def);
					else if (def.is("sequenceDef"))
						m = parsesequenceDef(b, def.findText(0), def.get(2));
					else if (def.is("listDef"))
						m = parseListDef(b, def);
					else if (def.is("setDef"))
						m = parseSetDef(b, def);
					else if (def.is("opDef"))
						m = parseOpDef(b, def);
					else if (def.is("choiceDef"))
						m = parseChoiceDef(b, def.findText(0), def.get(2));
					else if (def.is("importDef"))
						m = parseImportDef(b, def.findText(0), def.findText(2), def.findText(3));
					else
						throw new GrammarDefinitionException("Unimplemented defintion type:" + def.name());

					def.get(1).forEach(option => {
						if (option.isTerminal())
							m.setOption(option.text(), true);
						else
							m.setOption(option.findText(0), option.get(1).terminal().value());
					});
				});
				return b;
			}
			catch (Exception e) {
				throw new GrammarDefinitionException("Failed to construct language: " + e.getMessage(), e);
			}
		}

			private static  parseChoiceDef(b :Grammar, name:string, choices: Node):AbstractMatcher {
				var items : string[] = [];
				choices.forEach(child => items.add(toTerminalName(b, child)));

				var rule :ChoiceMatcher = new ChoiceMatcher(b, name, items);
				b.addRule(rule);
				return rule;
			}

			private static parseImportDef(b: Grammar, name:string, languagename:string, rulename:string): AbstractMatch {
				var rule :ImportMatcher = new ImportMatcher(b, name, languagename, rulename);
				b.addRule(rule);
				return rule;
			}

			private static  parseOpDef(b: Grammar, def :Node) : AbstractMatcher {
				var rule: OperatorMatcher = new OperatorMatcher(b, def.findText(0), true,
						toTerminalName(b, def.get(2)),
						toTerminalName(b, def.get(3)));
				b.addRule(rule);
				return rule;
			}

			private static  parseSetDef(b: Grammar, def: Node): AbstractMatcher {
				var seperatorOrNull:string = null;
				var preOrNull:string = null;
				var postOrNull:string = null;

				if (!def.get(3).isLambda()) { //matched 'using'?
					var items: Node = def.get(4);
					switch (items.size()) {
						case 1: seperatorOrNull = toTerminalName(b, items.get(0));
							break;
						case 3:
							preOrNull = toTerminalName(b, items.get(0));
							postOrNull = toTerminalName(b, items.get(2));
							seperatorOrNull = toTerminalName(b, items.get(1));
							break;
						default: throw new RuntimeException("Error in rule '" + def.findText(0) + "' of type set definition should contain 1 or 3 'using' elements. ");
					}
				}

				var items: string[] = def.get(2).map(choice => toTerminalName(b, choice));

				var rule: SetMatcher = new SetMatcher(b, def.findText(0), seperatorOrNull, preOrNull, postOrNull, items.toArray(new string[items.size()]));
				b.addRule(rule);
				return rule;
			}

			private static parseListDef(b: Grammar, def: Node) : AbstractMatcher {
				var items: Node = def.get(2);

				return constructList(b, def.findText(0), items);
			}

			private static parsesequenceDef(b: Grammar, name:string, items: Node): AbstractMatcher{
				var rule: SequenceMatcher = new SequenceMatcher(b, name);
				b.addRule(rule);
				items.forEach(item => {
					//0 = value, 1 = '?' -> required, 2 = options
					rule.addItem(new SequenceItem(toTerminalName(b, item.get(1)), item.get(2).isLambda(), item.get(0).isLambda() ? null : item.findText(0)));
				});
				return rule;
			}

			//given a token 'xyz' or xyz, returns the token, or the generated name for the terminal
			//TODO:has to change, tokens and ids are parsed in another way
			private static toTerminalName(b :Grammar, astNode: Node): string s{
				if (astNode.isTerminal()) {
					var text:string = astNode.text();
					if (text.startsWith("'") || text.startsWith("\""))
						return b.keyword((string) astNode.value());
					return text;
				}
				else {
				 	var name:string = "subrule_" + (b.subruleCount++);
					if (astNode.is("listSubrule")) { //List
						constructList(b, name, astNode.get(0));
					}
					else if (astNode.is("choiceSubrule")) {
						parseChoiceDef(b, name, astNode);
					}
					else if (astNode.is("sequenceSubrule")) {
						parsesequenceDef(b, name, astNode);
					}
					else
						throw new GrammarDefinitionException("Not implemented def: " + astNode.name());

					return name;
				}
			}

			private static  constructList(b: Grammar, name:string, items: Node): ListMatcher {
				//1 item = value, 2 items = value, seperator, 4 items =
				var token:string = null;
				var separator:string = null;
				var pre:string = null;
				var post:string = null;

				switch (items.size()) {
					case 1:
						token = toTerminalName(b, items.get(0));
						break;
					case 2:
						token = toTerminalName(b, items.get(0));
						separator = toTerminalName(b, items.get(1));
						break;
					case 3:
						pre = toTerminalName(b, items.get(0));
						token = toTerminalName(b, items.get(1));
						post = toTerminalName(b, items.get(2));
						break;
					case 4:
						pre = toTerminalName(b, items.get(0));
						token = toTerminalName(b, items.get(1));
						separator = toTerminalName(b, items.get(2));
						post = toTerminalName(b, items.get(3));
						break;
					default: throw new RuntimeException("Error in rule '" + name + "' of type list definition should contain 1 to 4 elements. ");
				}

				var rule: ListMatcher = new ListMatcher(b, name, token, separator, pre, post);
				b.addRule(rule);
				return rule;
			}

			private static hasOption (def: Node, option:string): bool {
				return !!def.get(1).find(opt => {
					if (opt.isTerminal() && opt.text().equals(option)) //simple
						return true;
					else if (!opt.isTerminal() && opt.findText(0).equals(option))
						return (Boolean) opt.get(1).terminal().value(Boolean.TRUE);
					return false;
				});
			}

			private static  parseTokenDef(b: Grammar, def: Node) : AbstractMatcher{
			 	var regexp:string = (def.get(2).text());
				regexp = regexp.substring(1, regexp.length() - 1).replaceAll("\\\\([\\/])", "$1");
				return b.addTokenmatcher(def.findText(0), regexp, hasOption(def, "whitespace"));
			}

			public static createBootstrapper():Grammar {
				//    	language nl.mweststrate.miniup
				//   	[
				//    	casesensitive = true,
				//    	startsymbol = langdef
				//    	]
				//    	token Comments1 [whitespace,style='color:green;font-style:italic'] 	: '//[^\\n]*\\n';
				//    	token Comments2 [whitespace] 	: '/\\*(?:.|[\\n\\r])*?\\*/';
				//    	token Whitespace [whitespace] 	: '\\s+';
				//    	token ID 						: '[a-zA-Z_][a-zA-Z_0-9]*';
				//    	token StringSingle 				: '\'([^\\\\]|(\\\\.))*?\'';
				//  	token StringDouble 				: '"([^\\\\]|(\\\\.))*?"';
				//        token RegExp : '/([^/]|(\\/))*?/'
				var b: Grammar = new Grammar("Miniup");
				b.setCaseInsensitive(true);

				addDefaultTokens(b);
				//TokenMatcher.BuiltinToken.SINGLELINECOMMENT.
				//        b.addTokenmatcher("Comments1", "//[^\\n]*\\n", true);
				//based on http://ostermiller.org/findcomment.html:
				//      b.addTokenmatcher("Comments2", "/\\*(?:.|[\\n\\r])*?\\*/", true);
				//    b.addTokenmatcher("whitespace","\\s+", true);
				//  b.addTokenmatcher("ID","[a-zA-Z_][a-zA-Z_0-9]*", false);
				//b.addTokenmatcher("StringSingle","'([^\\\\]|(\\\\.))*?'", false);
				// b.addTokenmatcher("StringSingle","'([^\\\\]|(\\\\.))*?'", false);
				//b.addTokenmatcher("RegExp", "/([^\\\\/]|(\\\\.))*/", false);
				//b.addTokenmatcher("StringSingle","'([\\\\\\n\\r\\t]|[^\\\\'])*'", false);

				/*
						sequence langdef 	: 'language' ID options definitions;
						list options 			: '[' option ',' ']';
						choice option[nonode] 	: valueoption | simpleoption;
						simpleoption 			: ID;
						valueoption 			: ID '=' value;
				*/
				b.addSequence("langdef",
						new SequenceItem(b.keyword("language")),
						new SequenceItem("IDENTIFIER"),
						new SequenceItem("options"),
						new SequenceItem("definitions"));

				b.addList("options", true, "option", b.keyword(","), b.keyword("["), b.keyword("]"), false);
				b.addChoice("option", "valueoption", "IDENTIFIER");

				b.addSequence("valueoption",
						new SequenceItem("IDENTIFIER"),
						new SequenceItem(b.keyword(":")),
						new SequenceItem("value"));

				/*
						list definitions 		: definition ';';
						choice definition 		: tokenDef | choiceDef | sequenceDef | listDef | setDef;

						sequence tokenDef 	: 'token' ID options? ':' StringSingle;

						sequence choiceDef 	: 'choice' ID options? ':' choices;
						list choices 			: value '|';
				*/
				b.addList("definitions", false, "definition", b.keyword(";"), null, null, true);
				b.addChoice("definition", "tokenDef", "choiceDef", "sequenceDef", "listDef", "setDef", "opDef", "importDef");

				b.addSequence("tokenDef",
						new SequenceItem(b.keyword("token")),
						new SequenceItem("IDENTIFIER"),
						new SequenceItem("options", false),
						new SequenceItem(b.keyword("=")),
						new SequenceItem("REGULAREXPRESSION"));

				b.addSequence("choiceDef",
						new SequenceItem(b.keyword("choice")),
						new SequenceItem("IDENTIFIER"),
						new SequenceItem("options", false),
						new SequenceItem(b.keyword("=")),
						new SequenceItem("choices"));

				b.addList("choices", false, "value", b.keyword("|"), null, null, false);

				/*
						sequence sequenceDef 	: 'sequenceosition' ID options? ':' sequenceItems;
						list sequenceItems 			: sequenceItem;
						sequence sequenceItem 	: value '?'? sequenceItemOptions?;
						set sequenceItemsOptions 	: 'newline' | 'indent' | 'outdent' | 'merge' using '[' ',' ']';

				*/
				b.addSequence("sequenceDef",
						new SequenceItem(b.keyword("sequence")),
						new SequenceItem("IDENTIFIER"),
						new SequenceItem("options", false),
						new SequenceItem(b.keyword("=")),
						new SequenceItem("sequenceItems"));

				b.addList("sequenceItems", false, "sequenceItem", null, null, null, false);

				b.addSequence("sequenceItemName",
						new SequenceItem("IDENTIFIER"),
						new SequenceItem(b.keyword(":")));

				b.addSequence("sequenceItem",
						new SequenceItem("sequenceItemName", false),
						new SequenceItem("value"),
						new SequenceItem(b.keyword("?"), false));
				//r = b.addSequence("sequenceItem", "value", b.keyword("?"), "sequenceItemOptions");

				b.addSet("sequenceItemOptions", b.keyword(","), b.keyword("["), b.keyword("]"), b.keyword("newline"), b.keyword("indent"), b.keyword("outdent"), b.keyword("merge"));
				/*
						sequence listDef		: 'list' ID options? ':' values;
						sequence setDef		: 'set'  ID options? ':' choices 'using'? values?;

						list values 			: value;
						choice value 			: |:string ID;
						choice 			::string StringSingle; // StringDouble ;
				*/
				b.addSequence("listDef",
						new SequenceItem(b.keyword("list")),
						new SequenceItem("IDENTIFIER"),
						new SequenceItem("options", false),
						new SequenceItem(b.keyword("=")),
						new SequenceItem("values"));

				b.addSequence("setDef",
						new SequenceItem(b.keyword("set")),
						new SequenceItem("IDENTIFIER"),
						new SequenceItem("options", false),
						new SequenceItem(b.keyword("=")),
						new SequenceItem("choices"),
						new SequenceItem(b.keyword("using"), false),
						new SequenceItem("values", false));
				/* sequence opDef = 'operator' IDENTIFIER options? '=' value value; */
				b.addSequence("opDef",
						new SequenceItem(b.keyword("operator")),
						new SequenceItem("IDENTIFIER"),
						new SequenceItem("options", false),
						new SequenceItem(b.keyword("=")),
						new SequenceItem("value"),
						new SequenceItem("value")
				);

				/* sequence importDef = 'import' IDENTIFIER options? '=' languagename:IDENTIFIER rulename: IDENTIFIER?; */
				b.addSequence("importDef",
						new SequenceItem(b.keyword("import")),
						new SequenceItem("IDENTIFIER"),
						new SequenceItem("options", false),
						new SequenceItem(b.keyword("=")),
						new SequenceItem("IDENTIFIER"),
						new SequenceItem(b.keyword(".")),
						new SequenceItem("IDENTIFIER")
				);

				b.addList("values", false, "value", null, null, null, false);
				b.addChoice("value", "SINGLEQUOTEDSTRING", "IDENTIFIER", "subRule");

				/*        choice Subrule =  ListSubrule | ChoiceSubrule | sequenceSubrule;

						sequence ListSubrule = '(' values ')' '*'; //list is prefered above the others as it disambiguates by '*'
						list ChoiceSubrule      = '(' value '|' ')'; //note that this one is ambigue with CombSubrule for '(' A ')'. That doesn't matter as they do effectively the same
						list sequenceSubrule        = '(' sequenceItem ')';
				*/
				b.addChoice("subRule", "listSubrule", "choiceSubrule", "sequenceSubrule");
				b.addSequence("listSubrule",
						new SequenceItem(b.keyword("(")),
						new SequenceItem("values"),
						new SequenceItem(b.keyword(")")),
						new SequenceItem(b.keyword("*")));

				b.addList("choiceSubrule", false, "value", b.keyword("|"), b.keyword("("), b.keyword(")"), false);
				b.addList("sequenceSubrule", false, "sequenceItem", null, b.keyword("("), b.keyword(")"), false);
				//b.addChoice("string", items)
				b.setStartSymbol("langdef");
				return b;
			}

			private static addDefaultTokens(b: Grammar) {
				TokenMatcher.BuiltinToken.values().forEach(tm => tm.registerTokenMatcher(b));
			}
		}

	export class GrammarDefinitionException extends Exception {

		public constructor(message: string) {
			super(message);
		}

		public constructor(message: string, cause: Exception) {
			super(message, cause);
		}

	}

	export class Grammar {
		static public languages = {}; //string -> grammar

		private tokenMatchers = {}; //string -> tokenmatcher
		private wstokenMatchers : TokenMatcher[] = [];

		private rules = {}; //string -> AbstracthMatcher
		private name:string;

		private caseInSensitive : bool;

		private startSymbol:string;

		private maxBacktrackingDepth: number = -1;
		public subruleCount: number = 1;

		private disableautowhitespace : bool;

		public static get (name: string): Grammar {
			if (!languages[name])
				throw new IllegalArgumentException("Unknown language: '" + name + "'");
			return languages.get(name);
		}

			public constructor(name: string) {
				this.name = name;
				languages.put(name, this);
			}

			public parse(input: string, startSymbol?:string) : Match {
				return new Parser(this, input).parse(startSymbol);
			}

			public getStartSymbol():string {
				return this.startSymbol;
			}

			public  getMatcher(token: string): AbstractMatcher {
				if (!this.rules.containsKey(token))
					throw new IllegalArgumentException("Undefined rule / token: '" + token + "'");
				return this.rules.get(token);
			}

			public getCaseInSensitive() : bool {
				return this.caseInSensitive;
			}

			public getName():string {
				return name;
			}

			public setStartSymbol(startSymbol: string) {
				this.startSymbol = startSymbol;
			}

			public setCaseInsensitive(b: boolean) {
				this.caseInSensitive = b;
			}

			public setDisableAutoWhitespace(b: boolean) {
				this.disableautowhitespace = b;
			}

			public addRule(rule: AbstractMatcher): string {
				if (this.rules.containsKey(rule.getName()))
					throw new IllegalArgumentException("A rule for '" + rule.getName() + "' has already been registered");
				this.rules.put(rule.getName(), rule);
				return rule.getName();
			}

			public addTokenmatcher(name: string, regexp:string, whiteSpace : bool): AbstractMatcher {
				try {
					var tm: TokenMatcher = new TokenMatcher(this, name, regexp, whiteSpace);
					this.tokenMatchers[regexp] = tm;
					if (whiteSpace)
						this.wstokenMatchers.push(tm);

					this.addRule(tm);
					return tm;
				}
				catch (java.util.regex.PatternSyntaxException e) {
					throw new GrammarDefinitionException("Invalid token definition, regular expression is invalid: " + e.getMessage(), e);
				}
			}

			public keyword(token: string) : string{

				var regexp:string = Pattern.quote(token);
				if (Pattern.matches("^[a-zA-Z_]+$", token)) //add a word boundary if the token is a word
					regexp += "\\b";

				var existing: TokenMatcher = this.tokenMatchers.get(regexp);
				if (existing != null) {
					if (existing.isWhiteSpace() || !existing.isKeyword())
						throw new GrammarDefinitionException("Failed to register keyword '" + token + "': the same token is already defined as a non-keyword or whitespace token");
					return existing.getName();
				}

				var tokenname:string = /*  "_t" + (tokenMatchers.size() + 1) */ "'" + token + "'";

				var tm: TokenMatcher = <TokenMatcher> this.addTokenmatcher(tokenname, regexp, false);
				tm.setIsKeyword(token);
				return tokenname;
			}

			public addList(name: string, nullable : bool, item:string, nullOrSeperator:string, nullOrPre:string, nullOrPost:string, allowTrailing : bool): string{
				var newrule: ListMatcher = new ListMatcher(this, name, item, nullOrSeperator, nullOrPre, nullOrPost);
				newrule.setOption(ListMatcher.NULLABLE_OPTION, nullable);
				newrule.setOption(ListMatcher.ALLOWTRAILING_OPTION, allowTrailing);
				return this.addRule(newrule);
			}

			public addSequence(string name, ...items: SequenceItem[]) : SequenceMatcher {
				var r: SequenceMatcher = new SequenceMatcher(this, name);
				items.forEach(item => r.addItem(item));
				this.addRule(r);
				return r;
			}

			public addChoice(name: string, ...items:string[]): string{
				return this.addRule(new ChoiceMatcher(this, name, items));
			}

			public addOperator(name: string, left : bool, operator:string, operand:string): string {
				return this.addRule(new OperatorMatcher(this, name, left, operator, operand));
			}

			public addSet(name: string, seperatorOrNull:string, preOrNull:string, postOrNull:string, ...items: string[]):string {}{
				return this.addRule(new SetMatcher(this, name, seperatorOrNull, preOrNull, postOrNull, items));
			}

			public setBacktracking(maxdepth: number) {
				this.maxBacktrackingDepth = maxdepth;

			}

			public getMaxRecursionDepth():number {
				return this.maxBacktrackingDepth;
			}

			public getWhiteSpaceTokens():TokenMatcher[] {
				return this.wstokenMatchers;
			}

			public ruleCount() :number {
				return Util.objectSize(this.rules);
			}

			public register() {
				//TODO: never used?
				Grammar.languages.put(this.getName(), this);
			}

			public getDisableAutoWhitespace() : bool {
				return this.disableautowhitespace;
			}

			public parsePartial (parentParser: Parser, parent: Match, rulename:string) : bool{
				return new Parser(this, parentParser.getInputString()).parsePartial(parentParser, parent, rulename);
			}
		}




	export class Match {
		private children : Match[] = [];
		private nonWSchildren : Match[] = [];

		private parent: Match;
		private start: number;
		private end: number;
		private matchedBy: AbstractMatcher;
		private isRoot : bool;
		private max: number;
		private terminal: Token = null;
		private nilMatch:string = null;
		private parser: Parser;

		public constructor(parser: Parser, parent?: Match, matchedBy?: AbstractMatcher) {
			this.parser = parser;
			if (parent) {
				this.start = parent.getLastCharPos();
				this.end = parent.getLastCharPos();
				this.matchedBy = matchedBy;
				parent.register(this);
				this.parent = parent;
			}
			else
				this.isRoot = true;
		}

			public register(match: Match) {
				this.children.push(match);
				//if its a match from the cache, we can consume all its tokens directly
				this.eat(match.charsConsumed());

				if (!match.isWhitespace())
					this.nonWSchildren.push(match);
			}

			public eat(amount: number) {
				this.end += amount;
				if (this.parent != null)
					this.parent.eat(amount);
				this.max = Math.max(max, end);
			}

			public  charsConsumed():number { return this.end - this.start; }

			public subMatchCount(excludeWS: boolean):number {
				if (excludeWS)
					return this.nonWSchildren.size();
				else
					return this.children.size();
			}

			public getMaximumMatchedCharPos() : number { return this.max; }

			public getLastCharPos() : number{
				return this.end;
			}

			/**
			 * reverts the last i matches.
			 * @param i
			 */
			public unMatch() {
				var m = children[children.length - 1];
				this.unEat(m.charsConsumed());

				this.children.splice(0, -1); //TODO: does this remove the last item?
				if (!m.isWhitespace())
					this.nonWSchildren.splice(0,-1);//TODO: does this remove the last item?
			}

			public isWhitespace() : bool {
				return this.getMatchedBy() instanceof TokenMatcher && (<TokenMatcher> this.getMatchedBy()).isWhiteSpace();
			}

			private unEat(items: number) {
				this.end -= items;
				if (this.parent != null)
					this.parent.unEat(items);
			}

			public toString():string {
				if (this.isRoot)
					return string.format("[%d : %d = [ROOT]]", this.start, this.end);
				return string.format("[%d : %d = %s []]", this.start, this.end, this.matchedBy.getName());
			}

			public toMatchString():string {
				if (this.isRoot)
					return this.subMatchCount(true) > 0 ? this.getSubMatch(0, true).toMatchString() : "";

				if (this.nilMatch != null)
					return "-";
			 	var res = "(" + this.matchedBy.getName() + ":";
				if (this.matchedBy instanceof TokenMatcher) {
					if (this.terminal == null)
						return "...";
					var tm = <TokenMatcher> matchedBy;
					if (tm.isWhiteSpace())
						return "";
					else if (tm.isKeyword())
						return this.terminal.getText();
					else
						return "'" + this.terminal.getText() + "'";
				}
				res += " " + this.nonWSchildren.map(x => x.toMatchString()).join(" ");
				return res + ")";
			}

			public lastChild(): Match {
				return this.children.[this.children.length - 1];
			}

			public getFirstCharPos():number {
				return this.start;
			}

			public setTerminal(terminal: Token) {
				this.terminal = terminal;
			}

			public setNil(token: string) {
				this.nilMatch = token;
			}

			public getLastMatch(excludeWS: boolean): Match {
				if (this.subMatchCount(excludeWS) == 0)
					throw new IllegalArgumentException("Empty matches do not have a last match");
				return this.getSubMatch(0, excludeWS);
			}

			public getSubMatch(i: number, excludeWS : bool): Match {
				if (!excludeWS) {
					if (i < this.children.length)
						return this.children[i];
				}
				else {
					if (i < this.nonWSchildren.length)
						return this.nonWSchildren[i];
				}
				throw new IllegalArgumentException();
			}


			public  getMatchedBy():AbstractMatcher {
				return this.matchedBy;
			}

			public  getParentMatch():Match {
				return this.parent;
			}

			public  toAST():Node {
				if (this.isRoot)
					return this.getSubMatch(0, true).toAST();
				//return new Node(this.getSubMatch(0, true).matchedBy.getName(), Arrays.asList(new Node [] { this.getSubMatch(0, true).toAST()}));
				if (this.nilMatch != null)
					return new Node(this.nilMatch);

				var res : Node = this.matchedBy.toAST(this);
				res.setSource(this.parser.getInputString().substring(this.getFirstCharPos(), this.getLastCharPos()));
				return res;
			}

			public  getTerminal():Token {
				return this.terminal;
			}

			public  getSubMatches():Match[] {
				return this.nonWSchildren;
			}

		}

	export class MatchMemoizer {
		cachehits: number = 0;
		cachemisses: number = 0;

		private matchCache = {}; //number -> { string -> match }

		isInCache (curpos: number, matcher: AbstractMatcher):bool {
			if (!Miniup.USE_TOKEN_MEMOIZATION)
				return false;

			var res : bool = matcher instanceof TokenMatcher;

			if (res) {
				if (!this.matchCache[curpos]) {
					this.matchCache[curpos] = {};
					res = false; //appearantly, it is not in cache :)
				else
					res = !!this.matchCache[curpos][matcher.getName()];
				}

				if (res)
					this.cachehits += 1;
				else
					this.cachemisses += 1;
				return res;
			}

		 consumeFromCache (parent: Match, token:string, curpos: number):bool {
				Match catched = this.matchCache[curpos][token];
				if (catched != null) {
					parent.register(catched);
					return true;
				}
				return false;
			}

		 storeInCache(parent: Match, curpos: number, matcher: AbstractMatcher) {
				if (!Miniup.USE_TOKEN_MEMOIZATION)
					return;

				if (matcher instanceof TokenMatcher)
					matchCache[curpos][matcher.getName()] =
							parent == null
									? undefined                //not a match
									: parent.lastChild()  //match
			}

		}



			export class ParseException extends Exception {

		private  msg: string[];
		private  stack=[]; //Stack <Pair <string, Integer >>

		/**
		 *
		 * @param p
		 * @param usebestMatchStack, true: display the stack that gave us the best result, false: display the current stack
		 * @param 		 */
		@SuppressWarnings("unchecked")
		public constructor(p: Parser, usebestMatchStack : bool, str:string) {
			super();
			this.msg = [];
			this.msg.push("Parse exception: " + str);

			if (p.bestPoint > -1)
				this.msg.push(Util.hightlightLine(p.getInputString(), p.getCurrentLineNr(p.bestPoint), p.getCurrentColNr(p.bestPoint)));

			if (usebestMatchStack && p.expected.size() > 0)
				this.msg.push("\nExpected: " + Util.join(p.expected, " or ") + "\n");

			this.stack = usebestMatchStack ? Util.clone(p.bestStack) : Util.clone(p.stack;

			if (Miniup.VERBOSE) {
				this.msg.push("\nParse stack: \n");

				this.stach.forEach(item =>
					this.msg.push("\t" + item.getFirst() + (item.getSecond() > 0 ? " no. " + (item.getSecond() + 1) : "") + "\n");
				);
			}
		}

			public getMessage:string() {
				return this.msg.join();
			}

			public getParseStack() {
				return this.stack;
			}

		}



	export class Parser {
		var language: Grammar;
		private inputstring:string = null;

		var stack = []; //new Stack < Pair < string, Integer >>();
		var bestStack = [];//new Stack < Pair < string, Integer >>();
		var expected = {}; //new HashSet <string >: ();

		var bestPoint: number = -1;

		var memoizer: MatchMemoizer;

		//Fields used for statistics
		private start: number;

		private calls: number = 0;
		private found: number = 0;
		private notfound: number = 0;


		public constructor(language: Grammar, input:string) {
			this.language = language;
			this.inputstring = input;
			this.memoizer = new MatchMemoizer();
		}

			public parsePartial(parentParser: Parser, parentMatch: Match, startSymbol:string):bool{
				this.stack = parentParser.stack;
				this.bestPoint = parentParser.bestPoint;
				this.consumeWhitespace(parentMatch);
			 	var res : bool = this.consume(parentMatch, startSymbol);

				if (this.bestPoint > parentParser.bestPoint) {
					parentParser.expected = this.expected;
					parentParser.bestPoint = this.bestPoint;
					parentParser.bestStack = this.bestStack;
				}

				return res;
			}

			public parse(startSymbol?: string): Match {
				this.start = new Date().getTime();

				var m = new Match(this);
				this.consumeWhitespace(m); //consume prepending whitespace

				var s:string = startSymbol;
				if (s == null && this.language.getStartSymbol() == null)
					throw new ParseException(this, false, "Grammar has no start symbol!");
				if (s == null)
					s = this.language.getStartSymbol();

				if (!this.consume(m, s)) {
					if (m.getMaximumMatchedCharPos() < this.inputstring.length())
						throw new ParseException(this, true, "Unexpected '" + this.inputstring.charAt(m.getMaximumMatchedCharPos()) + "' ");
					else
						throw new ParseException(this, true, "Unexpected end of input (EOF) ");
				}

				if (m.getLastCharPos() < this.inputstring.length())
					throw new ParseException(this, true, "Parsing succeeded, but not all input was consumed ");

				if (Miniup.SHOWSTATS)
					System.out.println(string.format("Finished parsing in %d ms. Stats: %d/%d/%d/%d/%d (read attempts/successfull reads/failed reads/cache hits/cache misses)",
							(new Date().getTime()) - this.start, this.calls, this.found, this.notfound, this.memoizer.cachehits, this.memoizer.cachemisses));
				return m;
			}

			public consume(parent: Match, token:string):bool {
				this.stack.push(Pair.pair(token, 0));
				var curpos = parent.getLastCharPos();
				var result = false;

				if (Miniup.VERBOSE)
					System.out.println(string.format("[%s:%s]%s", this.getCurrentLineNr(curpos), this.getCurrentColNr(curpos), Util.leftPad(token + " ?", this.stack.size())));
				this.calls += 1;

				try {
					if (this.language.getMaxRecursionDepth() != -1 && this.stack.size() > this.language.getMaxRecursionDepth())
						throw new ParseException(this, false, "Maximum stack depth reached. ");

					var matcher = this.language.getMatcher(token);
					this.storeExpected(matcher, parent, curpos);

					if (this.memoizer.isInCache(curpos, matcher)) {
						result = this.memoizer.consumeFromCache(parent, token, curpos);

						if (result)
							this.consumeWhitespace(parent);
					}

						//not in cache {
					else {
						if (matcher.match(this, parent)) {
							this.memoizer.storeInCache(parent, curpos, matcher);

							this.consumeWhitespace(parent);

							result = true;
						}
						else
							this.memoizer.storeInCache(null, curpos, matcher);
					}

					if (Miniup.VERBOSE && result)
						System.out.println(string.format("[%s:%s]%s", this.getCurrentLineNr(curpos), this.getCurrentColNr(curpos), Util.leftPad(token + " V", this.stack.size())));
					if (result) {
						this.found += 1;
						/*	        	if (Miniup.VERBOSE)
											System.out.println(Util.leftPad("...and now for something completely different: " +
													Util.trimLength(this.getInputString().substring(parent.getLastCharPos()),20),
													stack.size() -1));
						*/
				else
						this.notfound += 1;

						return result;
					}
					finally {
						this.stack.pop();
					}
				}

				private consumeWhitespace(parent: Match) {
					if (this.language.getDisableAutoWhitespace())
						return;

					var res = true;
					var curpos = parent.getLastCharPos();

					while (res) {
						res = false;
						this.language.getWhiteSpaceTokens().forEach(wsMatcher =>  {
							if (this.memoizer.isInCache(curpos, wsMatcher))
								res = this.memoizer.consumeFromCache(parent, wsMatcher.getName(), curpos);
							else
								res = wsMatcher.match(this, parent);
							if (res)
								break;
						});
					}
				}

				public consumeLambda(parent: Match, token:string) {
					var match = new Match(this, parent, null);
					match.setNil(token);

					if (Miniup.VERBOSE)
						System.out.println(Util.leftPad("-", this.stack.size()));
				}

				public getInputString:string() {
					return this.inputstring;
				}

				private storeExpected(matcher: AbstractMatcher, parent: Match, curpos: number) {
					if (curpos > this.bestPoint) {
						this.bestPoint = curpos;
						this.bestStack = Util.clone(this.sstack);
						this.expected.clear();
					}
					if (matcher instanceof TokenMatcher && curpos >= this.bestPoint) {
						this.expected.add(matcher.getName());
					}
				}

				public setStackIter(index: number) {
					this.stack.push([stack.pop()[0], index]);
				}

				public getCurrentLineNr(curpos: number):number {
					if (curpos == -1)
						return -1;

				 	var input = this.getInputString().substring(0, curpos);
					var line = 1 + Util.countMatches(input, "\n");
					return line;
				}

				public getCurrentColNr(curpos: number):number {
					if (curpos == -1)
						return -1;

					var input:string = this.getInputString().substring(0, curpos);
					var last = this.input.lastIndexOf('\n');
					var col = this.input.length() - last;
					return col;
				}

				public getCurrentInputLine(curpos: number):string {
					return Util.getInputLineByPos(this.getInputString(), curpos);
				}


			}







		public abstract class AbstractMatcher {

			var name:string;
			var language: Grammar;
		private options = {}; //new HashMap < string, Object >();

		public constructor(language: Grammar, name:string) {
			this.name = name;
			this.language = language;
		}

			public match (parser: Parser, parent: Match) : bool{
				var match = new Match(parser, parent, this);
				if (!this.performMatch(parser, match)) {
					parent.unMatch();
					return false;
				}

				return true;
			}

			performMatch(parser: Parser, parent: Match): bool { throw new Error("performMatch is an abstract method"); }

			public getName(): string { return this.name; }
			public getLanguage() : Grammar{ return this.language; }

			public toString(): string { return "Matcher: " + this.getName(); }

			public toAST(match: Match): Node { throw new Error("toAT is an abstract method"); }

			public setOption(key: string, object: any) {
				this.options[key] = object;
			}

			public getOption(key: string, defaultvalue: any):any {
				if (this.options[key] !== undefined)
					return options[key]
				return defaultvalue;
			}
		}




	export class ChoiceMatcher extends AbstractMatcher {

		private choices : string[] = [];

		public constructor(language: Grammar, name:string, items:string[]) {
			super(language, name);
			this.choices = Util.clone(items);
		}

		 performMatch (parser: Parser, parent: Match): bool {
				var index = 0, choice;
				for (var i = 0; i < this.choices.length, choice = this.choices[i]; i++) {
					parser.setStackIter(index++);
					if (parser.consume(parent, choice))
						return true;
				}
				return false;
			}

			public toAST(match: Match):Node {
				Node inner = match.getLastMatch(true).toAST();
				if (Boolean.FALSE.equals(this.getOption("wrap", Boolean.FALSE))) //nowrap?
					return inner;

				return new Node(this.getName(), inner);
			}

		}


		export class ImportMatcher extends AbstractMatcher {

		private languagename:string;
		private rulename:string;

		public constructor(language: Grammar, name:string, languagename:string, rulename:string) {
			super(language, name);
			this.languagename = languagename;
			this.rulename = rulename;
		}

		 performMatch(parser: Parser, parent: Match) : bool{
				if (!Grammar.languages.containsKey(languagename))

				try {
					return Grammar.get(languagename).parsePartial(parser, parent, rulename);
				}
				catch (ParseException inner) {
					//TODO: wrap exception? calculate real coordinates?
					throw inner;
				}
			}

			public  toAST(match: Match):Node {
				var inner = match.getLastMatch(true).toAST();
				if (!this.getOption("wrap", true)) //nowrap? //TODO: compare with string or with boolean value?
					return inner;

				return new Node(this.getName(), inner);
			}

		}

		export class ListMatcher extends AbstractMatcher {

		public static final NULLABLE_OPTION:string = "nullable";
		public static final ALLOWTRAILING_OPTION:string = "allowtrailing";

		private token:string;
		private pre:string = null;
		private post:string = null;
		private seperator:string;

		public constructor(language: Grammar, name:string, token:string, seperator:string, pre:string, post:string) {
			super(language, name);
			this.token = token;
			this.seperator = seperator;//TODO: separator
			this.pre = pre;
			this.post = post;
		}

		public performMatch (parser: Parser, parent: Match) : bool{
				//match pre token
				if (this.pre != null) {
					if (!parser.consume(parent, this.pre))
						return false;
				}
				var index = 0;
				var basepos = -1;

				if (this.post != null && parser.consume(parent, this.post))
					return this.isNullable();

				if (parser.consume(parent, this.token)) {
					while (this.seperator == null || parser.consume(parent, this.seperator)) {
						//detect lambda matching lists...
						if (parent.getLastCharPos() <= basepos)
							throw new ParseException(parser, false, "The rule '" + this.name + "', never ends, its items ('" + token + "') can match an empty string");

						basepos = parent.getLastCharPos();
						parser.setStackIter(++index);

						//something has been consumed, assert that it is not empty, otherwise we end up in an endless loop
						//if (seperator == null && parent.getLastMatch(true).charsConsumed() == 0)
						//	throw new ParseException(parser, false, "Unterminating match detected. List items should either consume terminals or be seperated.");

						if (this.post != null && parser.consume(parent, this.post))
							return this.seperator == null || this.allowTrailing();

						if (!parser.consume(parent, this.token)) {
							return this.post == null; //we should have read post already otherwise
						}
					}
					return this.post == null || parser.consume(parent, this.post);
				}
				//nothing matched yet..
				return this.isNullable() && (this.post == null || parser.consume(parent, this.post));
			}

			public allowTrailing() : bool {
				return this.getOption(ALLOWTRAILING_OPTION, false); //TODO: string compare
			}

			public isNullable() : bool() {
				return this.getOption(NULLABLE_OPTION, true);//TODO: string compare?
			}

			public toAST(match: Match):Node {
				var children : Node[] = [];
			var hasPre : bool = this.pre != null;
			var hasSep : bool = this.seperator != null;
			var hasPost : bool = this.post != null;
				for (var i = 0; i < match.subMatchCount(true); i++) {
					if (i == 0 && hasPre)
						continue;
					if (i == match.subMatchCount(true) - 1 && hasPost)
						continue;
					if (hasSep && i % 2 == (hasPre ? 0 : 1))
						continue;
					if (!match.getSubMatch(i, true).getMatchedBy().getName() == this.seperator)
						children.push(match.getSubMatch(i, true).toAST());
				}
				return new Node(this.name, children);
			}
		}




		export class OperatorMatcher extends AbstractMatcher {

		private operand:string;
		private operator:string;

		public static final RIGHT_OPTION:string = "right";//TODO: stupid name?

		public constructor(language: Grammar, name:string, leftassociative : bool, operator:string, operand:string) {
			super(language, name);
			this.operand = operand;
			this.operator = operator;
			if (!leftassociative)
				setOption(RIGHT_OPTION, true);
		}

		public performMatch (parser: Parser, parent: Match):bool{
				//left : a = b (op b)*
				// if (this.getIsLeftAssociative()) {
				if (this.isRepeatingState(parent)) //force backtrack for operators we already tried.
					return false;

				if (!parser.consume(parent, this.operand))
					return false;
				while (parser.consume(parent, this.operator)) {
					if (!parser.consume(parent, this.operand))
						return false;
				}
				return true;
			}

			/**
			 * The general idea behind this method that an operator cannot be matched if its already in the current parse
			 * stack, unless some other input has been consumed, in which case a new 'expression' is needed
			 * @param parent
			 * @return
			 */
			private isRepeatingState (parent: Match):bool {
				var p = parent.getParentMatch();
				while (p != null && p.getMatchedBy() != null) {
					var matcher = p.getMatchedBy();

					//something has been consumed?
					if (!(matcher instanceof OperatorMatcher)
						&& !(matcher instanceof ChoiceMatcher)
						&& p.charsConsumed() > 0)
						return false;

					//same rule as this rule? kill endless recursion right away!
					if (this == p.getMatchedBy())
						return true;

					p = p.getParentMatch();
				}
				return false;
			}

			public getIsLeftAssociative() : bool {
				return !this.getOption(RIGHT_OPTION, false));
			}

			public toAST(match: Match):Node {
				var matches : Match[] = match.getSubMatches();
				return toASTNodeHelper(matches);
			}

			private toASTNodeHelper(matches: Match[]):Node {
				var children: Node[] = [];
				var size = matches.size();
				if (size == 3) {
					children.push(matches.get(1).toAST());
					children.push(matches.get(0).toAST());
					children.push(matches.get(2).toAST());
				}
				else if (size == 1) {
					return (matches.get(0).toAST());
				}
				else if (this.getIsLeftAssociative()) {
					children.push(matches.get(size - 2).toAST());
					children.push(this.toASTNodeHelper(matches.subList(0, size - 2)));
					children.push(matches.get(size - 1).toAST());
				}
				else {
					children.push(matches.get(1).toAST());
					children.push(matches.get(0).toAST());
					children.push(this.toASTNodeHelper(matches.subList(2, size)));
				}
				return new Node(this.name, children);
			}

		}



	class SequenceItem {
		private item:string;
		private required : bool;
		private name:string;

		public constructor(item: string, required : bool = true, name:string = null) {
			this.item = item;
			this.required = required;
			this.name = name;
		}
	}

	export class SequenceMatcher extends AbstractMatcher {

		public constructor(language: Grammar, name:string) {
			super(language, name);
		}

		private toMatch : SequenceItem[] = [];

		public performMatch(parser: Parser, parent: Match): bool{
				for (var i = 0; i < this.toMatch.size(); i++) {
					parser.setStackIter(i);
					var item = this.toMatch.get(i);
					if (parser.consume(parent, item.item))
						continue;
					if (item.required)
						return false;
					parser.consumeLambda(parent, item.item);
				}
				return true;
			}

			public addItem(item: SequenceItem) {
				this.toMatch.add(item);
			}

			public toAST(match: Match): Node {
				var children : Node[] = [];
				var childMap = {}; //string ->Node

				for (var i = 0; i < match.subMatchCount(true); i++) {
					if (this.toMatch.get(i).required == false ||
						!(match.getSubMatch(i, true).getMatchedBy() instanceof TokenMatcher) ||
						!(<TokenMatcher> match.getSubMatch(i, true).getMatchedBy()).isKeyword()) {

							var child = match.getSubMatch(i, true).toAST();
							children.push(child);
							var name = toMatch.get(i).name;
							if (name != null && !name.isEmpty())
								childMap.put(name, child);
						}
				}
				return new Node(this.name, children, childMap);
			}
		}

		export class SetMatcher extends AbstractMatcher {

		private seperator:string; //TODO: separator
		private items : string[];
		private pre:string;
		private post:string;

		public constructor(language: Grammar, name:string, seperatorOrNull:string, preOrNull:string, postOrNull:string, ...items: string[]) {
			super(language, name);
			this.seperator = seperatorOrNull;
			this.pre = preOrNull;
			this.post = postOrNull;
			this.items = items;
		}

		public performMatch(parser: Parser, parent: Match) : bool {
			if (this.pre != null && !parser.consume(parent, this.pre))
				return false;

			var available  = Util.clone(this.items);
			var matched : bool = true;
			var sepmatched : bool = false;
			while (available.length > 0 && matched) {
				matched = false;
				available.forEach(token => {
					if (parser.consume(parent, token)) {
						available.remove(token);
						matched = true;
						if (this.seperator == null)
							break;
						else
							sepmatched = parser.consume(parent, this.seperator);
					}
				});
			}
			if (sepmatched) //there was a trailing seperator!
				return false;

			return this.post == null || parser.consume(parent, this.post);
		}

		public toAST(match: Match): Node {
			var children : Node[] = [];
			var hasPre : bool = this.pre != null;
			var hasSep : bool = this.seperator != null;
			var hasPost : bool = this.post != null;
			for (var i = 0; i < match.subMatchCount(true); i++) {
				if (i == 0 && hasPre)
					continue;
				if (i == match.subMatchCount(true) - 1 && hasPost)
					continue;
				if (hasSep && i % 2 == (hasPre ? 0 : 1))
					continue;
				children.add(match.getSubMatch(i, true).toAST());
			}
			return new Node(this.name, children);
		}
	}

	export class BuiltinToken {
		constructor(private name: string, private regexp: string, private whitespace : bool) {
		}

		public TokenMatcher registerTokenMatcher(language: Grammar) {
			return <TokenMatcher> language.addTokenmatcher(this.name, this.regexp, this.whitespace);
		}


		public static IDENTIFIER = new BuiltinToken("IDENTIFIER","[a-zA-Z_][a-zA-Z_0-9]*", false);
		public static WHITESPACE = new BuiltinToken("WHITESPACE","\\s+", true);
		public static INTEGER = new BuiltinToken("INTEGER","-?\\d+", false);
		public static FLOAT = new BuiltinToken("FLOAT","-?\\d+(\\.\\d+)?(e\\d+)?", false);
		public static SINGLEQUOTEDSTRING = new BuiltinToken("SINGLEQUOTEDSTRING","'(?>[^\\\\']|(\\\\[btnfr\"'\\\\]))*'", false);
		public static DOUBLEQUOTEDSTRING = new BuiltinToken("DOUBLEQUOTEDSTRING","\"(?>[^\\\\\"]|(\\\\[btnfr\"'\\\\]))*\"", false);
		public static SINGLELINECOMMENT = new BuiltinToken("SINGLELINECOMMENT","//[^\\n]*(\\n|$)", true);
		public static MULTILINECOMMENT = new BuiltinToken("MULTILINECOMMENT","/\\*(?:.|[\\n\\r])*?\\*/", true);
		public static BOOLEAN = new BuiltinToken("BOOLEAN","true|false", false);
		public static REGULAREXPRESSION = new BuiltinToken("REGULAREXPRESSION","/(?>[^\\\\/]|(\\\\.))*/", false);
	}

	export class TokenMatcher extends AbstractMatcher {


		/**
		 * Takes a willed arsed quess to confert a tokens text to a native java primitive, tries
		 * - 		 * : bool" - long
		 * - float
		 * - quoted 		 *:string - javascript style regex
		 * - return original input
		 * @param input
		 * @return
		 */
		public static textToValue(input: string): any {
			if (input == null)
				return null;
			if (input.matches("^" + BuiltinToken.BOOLEAN.regexp + "$"))
				return Boolean.parseBoolean(input);
			if (input.matches("^" + BuiltinToken.INTEGER.regexp + "$"))
				return Long.parseLong(input);
			if (input.matches("^" + BuiltinToken.FLOAT.regexp + "$"))
				return Double.parseDouble(input);
			if ((input.startsWith("'") && input.endsWith("'")) || (input.startsWith("\"") && input.endsWith("\"")))
				return Util.unescape(Util.substring(input, 1, -1));
			if (input.startsWith("/") && input.endsWith("/"))
				return Pattern.compile(Util.substring(input, 1, -1).replaceAll("\\\\([\\/])", "$1"));
			return input;
		}


		private regexp: Regex;
			private isWhiteSpace : bool;
			private isKeyword : bool;
			private keyword:string;

			public constructor(language: Grammar, name:string, regexp:string, whiteSpace : bool) {
				super(language, name);
				this.regexp = Pattern.compile("\\A" + regexp, Pattern.MULTILINE &
					(language.getCaseInSensitive() ? Pattern.CASE_INSENSITIVE : 0)
				);
				this.isWhiteSpace = whiteSpace;
			}

			public match(input: string): Token {
				//System.out.println("About to match " + this.name + this.language.getName() + regexp.pattern());
				var m = regexp.matcher(input);
				if (!m.find())
					return null;

				var string = input.substring(0, m.end());

				return new Token(this, text);
			}

			public isWhiteSpace : bool() {
				return this.isWhiteSpace;
			}

		 performMatch (parser: Parser, parent: Match): bool {
				var curpos = parent.getLastCharPos();
				var rest = parser.getInputString().substring(curpos);
				var next = this.match(rest);

				if (next != null) {

					//if (Miniup.VERBOSE &&  !next.getText().trim().isEmpty())
					//	System.out.println(" -- " + this.name + " --> `" + next.getText() + "`");

					next.setCoords(parser.getCurrentLineNr(curpos), parser.getCurrentColNr(curpos));
					parent.setTerminal(next);
					parent.eat(next.getText().length());
					return true;
				}
				return false;
			}

			public getName():string {
				return this.name;
			}

			public toString():string {
				return string.format("[TokenMatcher '%s'->%s]", this.regexp.pattern(), this.name);
			}

			public getRegexp():string {
				return this.regexp.pattern();
			}

			/** indicates that this is a generated token, which should not be included in output etc */
			public setIsKeyword(keyword: string) {
				this.keyword = keyword;
				this.isKeyword = true;
			}

			public getKeyword():string { return this.keyword; }

			public isKeyword() : bool {
				return this.isKeyword;
			}

			public toAST(match: Match):Node {
				return new Node(this.name, match.getTerminal());
			}


		}


	}
}