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

		int line = 0;
		int col = 0;
		private TokenMatcher matcher;
		private text:string;

		/**
		 * Constructor used by the parser to create new tokens
		 * @param tokenMatcher
		 * @param text
		 */
		public Token(TokenMatcher tokenMatcher, text:string) {
			this.matcher = tokenMatcher;
			this.text = text;
		}

			/**
			 * Used by the parser to set the coords of this token in the original input file
			 * @param line
			 * @param col
			 */
			public setCoords(int line, int col) {
				this.line = line;
				this.col = col;
			}

			/**
			 * Returns the text matched by this token
			 * @return
			 */
			public getText:string() { return this.text; }

			/**
			 * Returns the line number at which this token was matched
			 * @return
			 */
			public int getLineNr() { return line; }

			/**
			 * returns the column number at which this token was matched
			 * @return
			 */
			public int getColNr() { return col; }

			/**
			 * returns whether this token was just matching whitespace. Whitespace matching tokens are not added to the Abstract Syntax Tree generated by the parser
			 * @return
			 */
			public isWhiteSpace : bool() { return matcher.isWhiteSpace(); }

			public toString:string() {
				return string.format("<%s @ %d:%d = %s>", matcher.getName(), line, col, text.replaceAll("\n", "\\\\n").replaceAll("\r", ""));
			}

		}



		export class GrammarBuilder {

		public static Grammar languageFromAST(Node langNode) {}{
			try {
				Node t = langNode;//.get(0);
				Grammar b = new Grammar(t.get(0).text());
				for (Node option: t.get(1)) {
				 name:string = option.terminal().text();
				 value:string = option.isTerminal() ? "true" : option.findText(1);

					if (name.equals("casesensitive"))
						b.setCaseInsensitive(!Boolean.parseBoolean(value));
					else if (name.equals("disableautowhitespace"))
						b.setDisableAutoWhitespace(Boolean.parseBoolean(value));
					else if (name.equals("startsymbol"))
						b.setStartSymbol(value);
					else if (name.equals("usedefaulttokens")) {
						if ("true".equals(value))
							addDefaultTokens(b);
					}
					else
						throw new IllegalArgumentException("Error while creating language: Option '" + option.findText(0) + "' is unknown.");
				}
				for (Node def: t.get(2)) {
					AbstractMatcher m = null;
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

					for (Node option: def.get(1)) {
						if (option.isTerminal())
							m.setOption(option.text(), true);
						else
							m.setOption(option.findText(0), option.get(1).terminal().value());
					}
				}
				return b;
			}
			catch (Exception e) {
				throw new GrammarDefinitionException("Failed to construct language: " + e.getMessage(), e);
			}
		}

			private static AbstractMatcher parseChoiceDef(Grammar b, name:string, Node choices) {}{
				List < >:string items = new ArrayList < >:string ();
				for (Node child: choices)
					items.add(toTerminalName(b, child));

				ChoiceMatcher rule = new ChoiceMatcher(b, name, items.toArray(new string[items.size()]));
				b.addRule(rule);
				return rule;
			}

			private static AbstractMatcher parseImportDef(Grammar b, name:string, languagename:string, rulename:string) {}{
				ImportMatcher rule = new ImportMatcher(b, name, languagename, rulename);
				b.addRule(rule);
				return rule;
			}

			private static AbstractMatcher parseOpDef(Grammar b, Node def) {}{
				OperatorMatcher rule = new OperatorMatcher(b, def.findText(0), true,
						toTerminalName(b, def.get(2)),
						toTerminalName(b, def.get(3)));
				b.addRule(rule);
				return rule;
			}

			private static AbstractMatcher parseSetDef(Grammar b, Node def) {}{
			 seperatorOrNull:string = null;
			 preOrNull:string = null;
			 postOrNull:string = null;

				if (!def.get(3).isLambda()) { //matched 'using'?
					Node items = def.get(4);
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

				List < >:string items = new ArrayList < >:string ();
				for (Node choice: def.get(2)) {
					items.add(toTerminalName(b, choice));
				}

				SetMatcher rule = new SetMatcher(b, def.findText(0), seperatorOrNull, preOrNull, postOrNull, items.toArray(new string[items.size()]));
				b.addRule(rule);
				return rule;
			}

			private static AbstractMatcher parseListDef(Grammar b, Node def) {}{
				Node items = def.get(2);

				return constructList(b, def.findText(0), items);
			}

			private static AbstractMatcher parsesequenceDef(Grammar b, name:string, Node items) {}{
				SequenceMatcher rule = new SequenceMatcher(b, name);
				b.addRule(rule);
				for (Node item: items) {
					//0 = value, 1 = '?' -> required, 2 = options
					rule.addItem(new SequenceItem(toTerminalName(b, item.get(1)), item.get(2).isLambda(), item.get(0).isLambda() ? null : item.findText(0)));
				}
				return rule;
			}

			//given a token 'xyz' or xyz, returns the token, or the generated name for the terminal
			//TODO:has to change, tokens and ids are parsed in another way
			private static toTerminalName:string(Grammar b, Node astNode) {}{
				if (astNode.isTerminal()) {
				 text:string = astNode.text();
					if (text.startsWith("'") || text.startsWith("\""))
						return b.keyword((string) astNode.value());
					return text;
				}
				else {
				 name:string = "subrule_" + (b.subruleCount++);
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

			private static ListMatcher constructList(Grammar b, name:string, Node items) {}{
				//1 item = value, 2 items = value, seperator, 4 items =
			 token:string = null;
			 separator:string = null;
			 pre:string = null;
			 post:string = null;

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

				ListMatcher rule = new ListMatcher(b, name, token, separator, pre, post);
				b.addRule(rule);
				return rule;
			}

			private static hasOption : bool(Node def, option:string) {
				for (Node opt: def.get(1)) {
					if (opt.isTerminal() && opt.text().equals(option)) //simple
						return true;
					else if (!opt.isTerminal() && opt.findText(0).equals(option))
						return (Boolean) opt.get(1).terminal().value(Boolean.TRUE);
				}
				return false;
			}

			private static AbstractMatcher parseTokenDef(Grammar b, Node def) {}{
			 regexp:string = (def.get(2).text());
				regexp = regexp.substring(1, regexp.length() - 1).replaceAll("\\\\([\\/])", "$1");
				return b.addTokenmatcher(def.findText(0), regexp, hasOption(def, "whitespace"));
			}

			public static Grammar createBootstrapper() {}{
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
				Grammar b = new Grammar("Miniup");
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

			private static addDefaultTokens(Grammar b)
					{}{
						for (BuiltinToken tm: TokenMatcher.BuiltinToken.values())
							tm.registerTokenMatcher(b);
					}

		}

		export class GrammarDefinitionException extends Exception {
		/**
		 *
		 */
		private static final long serialVersionUID = -474472271515546559L;

		public GrammarDefinitionException(string message) {
			super(message);
		}

			public GrammarDefinitionException(string message, Exception cause) {
				super(message, cause);
			}


		}




		export class Grammar {
		static public Map <string, Grammar > languages = new HashMap < string, Grammar >();

		private Map <string, TokenMatcher > tokenMatchers = new HashMap < string, TokenMatcher >();
		private Vector <TokenMatcher > wstokenMatchers = new Vector < TokenMatcher > ();

		private Map <string, AbstractMatcher > rules = new HashMap < string, AbstractMatcher >();
		private name:string;

		private caseInSensitive : bool;

		private startSymbol:string;

		private int maxBacktrackingDepth = -1;
		public int subruleCount = 1;

		private disableautowhitespace : bool;

		public static Grammar get (string name) {
			if (!languages.containsKey(name))
				throw new IllegalArgumentException("Unknown language: '" + name + "'");
			return languages.get(name);
		}

			public Grammar(string name) {
				this.name = name;
				languages.put(name, this);
			}

			public Match parse(string input) {}{
				return parse(input, null);
			}

			public Match parse(string input, startSymbol:string) {}{
				return new Parser(this, input).parse(startSymbol);
			}

			public getStartSymbol:string() {
				return this.startSymbol;
			}

			public AbstractMatcher getMatcher(string token) {}{
				if (!this.rules.containsKey(token))
					throw new IllegalArgumentException("Undefined rule / token: '" + token + "'");
				return this.rules.get(token);
			}

			public getCaseInSensitive : bool() {
				return this.caseInSensitive;
			}

			public getName:string() {
				return name;
			}

			public setStartSymbol(string startSymbol) {
				this.startSymbol = startSymbol;
			}

			public setCaseInsensitive(boolean b) {
				this.caseInSensitive = b;
			}

			public setDisableAutoWhitespace(boolean b) {
				this.disableautowhitespace = b;
			}

			public addRule:string(AbstractMatcher rule) {}{
				if (this.rules.containsKey(rule.getName()))
					throw new IllegalArgumentException("A rule for '" + rule.getName() + "' has already been registered");
				this.rules.put(rule.getName(), rule);
				return rule.getName();
			}

			public AbstractMatcher addTokenmatcher(string name, regexp:string, whiteSpace : bool) {}{
				try {
					TokenMatcher tm = new TokenMatcher(this, name, regexp, whiteSpace);
					tokenMatchers.put(regexp, tm);
					if (whiteSpace)
						wstokenMatchers.add(tm);

					addRule(tm);
					return tm;
				}
				catch (java.util.regex.PatternSyntaxException e) {
					throw new GrammarDefinitionException("Invalid token definition, regular expression is invalid: " + e.getMessage(), e);
				}
			}

			public keyword:string(string token) {}{

			 regexp:string = Pattern.quote(token);
				if (Pattern.matches("^[a-zA-Z_]+$", token)) //add a word boundary if the token is a word
					regexp += "\\b";

				TokenMatcher existing = this.tokenMatchers.get(regexp);
				if (existing != null) {
					if (existing.isWhiteSpace() || !existing.isKeyword())
						throw new GrammarDefinitionException("Failed to register keyword '" + token + "': the same token is already defined as a non-keyword or whitespace token");
					return existing.getName();
				}

			 tokenname:string = /*  "_t" + (tokenMatchers.size() + 1) */ "'" + token + "'";

				TokenMatcher tm = (TokenMatcher) this.addTokenmatcher(tokenname, regexp, false);
				tm.setIsKeyword(token);
				return tokenname;
			}

			public addList:string(string name, nullable : bool, item:string, nullOrSeperator:string, nullOrPre:string, nullOrPost:string, allowTrailing : bool) {}{
				ListMatcher newrule = new ListMatcher(this, name, item, nullOrSeperator, nullOrPre, nullOrPost);
				newrule.setOption(ListMatcher.NULLABLE_OPTION, (Boolean) nullable);
				newrule.setOption(ListMatcher.ALLOWTRAILING_OPTION, (Boolean) allowTrailing);
				return addRule(newrule);
			}

			public SequenceMatcher addSequence(string name, SequenceItem...items) {}{
				SequenceMatcher r = new SequenceMatcher(this, name);
				for (SequenceItem item: items)
					r.addItem(item);
				addRule(r);
				return r;
			}

			public addChoice:string(string name, string...items) {}{
				return addRule(new ChoiceMatcher(this, name, items));
			}

			public addOperator:string(string name, left : bool, operator:string, operand:string) {}{
				return addRule(new OperatorMatcher(this, name, left, operator, operand));
			}

			public addSet:string(string name, seperatorOrNull:string, preOrNull:string, postOrNull:string, string...items) {}{
				return addRule(new SetMatcher(this, name, seperatorOrNull, preOrNull, postOrNull, items));
			}

			public setBacktracking(int maxdepth) {
				this.maxBacktrackingDepth = maxdepth;

			}

			public int getMaxRecursionDepth() {
				return this.maxBacktrackingDepth;
			}

			public List < TokenMatcher > getWhiteSpaceTokens() {
				return this.wstokenMatchers;
			}

			public int ruleCount() {
				return this.rules.size();
			}

			public register() {
				Grammar.languages.put(this.getName(), this);
			}

			public getDisableAutoWhitespace : bool() {
				return this.disableautowhitespace;
			}

			public parsePartial : bool(Parser parentParser, Match parent, rulename:string) {}{
				return new Parser(this, parentParser.getInputString()).parsePartial(parentParser, parent, rulename);
			}
		}




		export class Match {
		private List <Match > children = new ArrayList < Match > ();
		private List <Match > nonWSchildren = new ArrayList < Match > ();

		private Match parent;
		private int start;
		private int end;
		private AbstractMatcher matchedBy;
		private isRoot : bool;
		private int max;
		private Token terminal = null;
		private nilMatch:string = null;
		private Parser parser;

		public Match(Parser parser, Match parent, AbstractMatcher matchedBy) {
			this.parser = parser;
			start = parent.getLastCharPos();
			end = parent.getLastCharPos();
			this.matchedBy = matchedBy;
			parent.register(this);
			this.parent = parent;
		}

			public Match(Parser parser) {
				this.parser = parser;
				isRoot = true;
			}

			public register(Match match) {
				children.add(match);
				//if its a match from the cache, we can consume all its tokens directly
				eat(match.charsConsumed());

				if (!match.isWhitespace())
					nonWSchildren.add(match);
			}

			public eat(int amount) {
				end += amount;
				if (parent != null)
					parent.eat(amount);
				// else
				max = Math.max(max, end);
			}

			public int charsConsumed() { return end - start; }

			public int subMatchCount(boolean excludeWS) {
				if (excludeWS)
					return nonWSchildren.size();
				else
					return children.size();
			}

			public int getMaximumMatchedCharPos() { return max; }

			public int getLastCharPos() {
				return end;
			}

			/**
			 * reverts the last i matches.
			 * @param i
			 */
			public unMatch() {
				Match m = children.get(children.size() - 1);
				this.unEat(m.charsConsumed());

				children.remove(children.size() - 1);
				if (!m.isWhitespace())
					nonWSchildren.remove(nonWSchildren.size() - 1);
			}

			public isWhitespace : bool() {
				return getMatchedBy() instanceof TokenMatcher && ((TokenMatcher) getMatchedBy()).isWhiteSpace();
			}

			private unEat(int items) {
				end -= items;
				if (parent != null)
					parent.unEat(items);
			}

			public toString:string() {
				if (isRoot)
					return string.format("[%d : %d = [ROOT]]", start, end);
				return string.format("[%d : %d = %s []]", start, end, matchedBy.getName());
			}

			public toMatchString:string() {
				if (this.isRoot)
					return this.subMatchCount(true) > 0 ? this.getSubMatch(0, true).toMatchString() : "";

				if (this.nilMatch != null)
					return "-";
			 res:string = "(" + this.matchedBy.getName() + ":";
				if (matchedBy instanceof TokenMatcher) {
					if (terminal == null)
						return "...";
					TokenMatcher tm = (TokenMatcher) matchedBy;
					if (tm.isWhiteSpace())
						return "";
					else if (tm.isKeyword())
						return terminal.getText();
					else
						return "'" + terminal.getText() + "'";
				}
				for (Match m: this.nonWSchildren) {
					res += " " + m.toMatchString();
				}
				return res + ")";
			}

			public Match lastChild() {
				return this.children.get(this.children.size() - 1);
			}

			public int getFirstCharPos() {
				return start;
			}

			public setTerminal(Token terminal) {
				this.terminal = terminal;
			}

			public setNil(string token) {
				this.nilMatch = token;
			}

			public Match getLastMatch(boolean excludeWS) {
				if (this.subMatchCount(excludeWS) == 0)
					throw new IllegalArgumentException("Empty matches do not have a last match");
				return this.getSubMatch(0, excludeWS);
			}

			public Match getSubMatch(int i, excludeWS : bool) {
				if (!excludeWS) {
					if (i < this.children.size())
						return this.children.get(i);
				}
				else {
					if (i < this.nonWSchildren.size())
						return this.nonWSchildren.get(i);
				}
				throw new IllegalArgumentException();
			}


			public AbstractMatcher getMatchedBy() {
				return this.matchedBy;
			}

			public Match getParentMatch() {
				return parent;
			}

			public Node toAST() {
				if (this.isRoot)
					return this.getSubMatch(0, true).toAST();
				//return new Node(this.getSubMatch(0, true).matchedBy.getName(), Arrays.asList(new Node [] { this.getSubMatch(0, true).toAST()}));
				if (this.nilMatch != null)
					return new Node(this.nilMatch);

				Node res = this.matchedBy.toAST(this);
				res.setSource(this.parser.getInputString().substring(getFirstCharPos(), getLastCharPos()));
				return res;
			}

			public Token getTerminal() {
				return terminal;
			}

			public List < Match > getSubMatches() {
				return this.nonWSchildren;
			}



		export class MatchMemoizer {
		int cachehits = 0;
		int cachemisses = 0;

		Map <Integer, Map <string, Match >> matchCache = new HashMap < Integer, Map <string, Match >>();

	 isInCache : bool(int curpos, AbstractMatcher matcher) {
			if (!Miniup.USE_TOKEN_MEMOIZATION)
				return false;

		 res : bool = matcher instanceof TokenMatcher;

			if (res) {
				if (!matchCache.containsKey(curpos)) {
					matchCache.put(curpos, new HashMap < string, Match > ());
						res = false; //appearantly, it is not in cache :)
					}
					else
					res = matchCache.get(curpos).containsKey(matcher.getName());
				}

				if (res)
					cachehits += 1;
				else
					cachemisses += 1;
				return res;
			}

		 consumeFromCache : bool(Match parent, token:string, int curpos) {
				Match catched = matchCache.get(curpos).get(token);
				if (catched != null) {
					parent.register(catched);
					return true;
				}
				return false;
			}

		 storeInCache(Match parent, int curpos, AbstractMatcher matcher) {
				if (!Miniup.USE_TOKEN_MEMOIZATION)
					return;

				if (matcher instanceof TokenMatcher)
					matchCache.get(curpos).put(matcher.getName(),
							parent == null
									? null                //not a match
									: parent.lastChild()  //match
							);
			}

		}



			export class ParseException extends Exception {

		/**
		 *
		 */
		private static final long serialVersionUID = -826584894413162138L;
		private StringBuilder msg;
		private Stack <Pair <string, Integer >> stack;

		/**
		 *
		 * @param p
		 * @param usebestMatchStack, true: display the stack that gave us the best result, false: display the current stack
		 * @param 		 */:string
		@SuppressWarnings("unchecked")
		public ParseException(Parser p, usebestMatchStack : bool, string:string) {
			super();
			this.msg = new StringBuilder();
			msg.append("Parse exception: " + string);

			if (p.bestPoint > -1)
				msg.append(Util.hightlightLine(p.getInputString(), p.getCurrentLineNr(p.bestPoint), p.getCurrentColNr(p.bestPoint)));

			if (usebestMatchStack && p.expected.size() > 0)
				msg.append("\nExpected: " + Util.join(p.expected, " or ") + "\n");

			this.stack = (Stack < Pair < string, Integer >>)(usebestMatchStack ? p.bestStack.clone() : p.stack.clone());

			if (Miniup.VERBOSE) {
				msg.append("\nParse stack: \n");

				for (Pair < string, Integer > item: this.stack)
					msg.append("\t" + item.getFirst() + (item.getSecond() > 0 ? " no. " + (item.getSecond() + 1) : "") + "\n");
			}
		}

			public getMessage:string() {
				return msg.toString();
			}

			public Stack < Pair < string, Integer >> getParseStack() {
				return this.stack;
			}

		}



		export class Parser {
		Grammar language;
		private inputstring:string = null;;

		Stack <Pair <string, Integer >> stack = new Stack < Pair < string, Integer >>();
		Stack <Pair <string, Integer >> bestStack = new Stack < Pair < string, Integer >>();
		Set <string > expected = new HashSet < >:string ();

		int bestPoint = -1;

		MatchMemoizer memoizer;

		//Fields used for statistics
		private long start;

		private int calls = 0;
		private int found = 0;
		private int notfound = 0;


		public Parser(Grammar language, input:string) {
			this.language = language;
			this.inputstring = input;
			memoizer = new MatchMemoizer();
		}

			public Match parse() {}{
				return parse(null);
			}

			public parsePartial : bool(Parser parentParser, Match parentMatch, startSymbol:string) {}{
				this.stack = parentParser.stack;
				this.bestPoint = parentParser.bestPoint;
				consumeWhitespace(parentMatch);
			 res : bool = consume(parentMatch, startSymbol);

				if (bestPoint > parentParser.bestPoint) {
					parentParser.expected = expected;
					parentParser.bestPoint = bestPoint;
					parentParser.bestStack = bestStack;
				}

				return res;
			}

			public Match parse(string startSymbol) {}{
				this.start = new Date().getTime();

				Match m = new Match(this);
				consumeWhitespace(m); //consume prepending whitespace

			 s:string = startSymbol;
				if (s == null && language.getStartSymbol() == null)
					throw new ParseException(this, false, "Grammar has no start symbol!");
				if (s == null)
					s = language.getStartSymbol();

				if (!consume(m, s)) {
					if (m.getMaximumMatchedCharPos() < inputstring.length())
						throw new ParseException(this, true, "Unexpected '" + inputstring.charAt(m.getMaximumMatchedCharPos()) + "' ");
					else
						throw new ParseException(this, true, "Unexpected end of input (EOF) ");
				}

				if (m.getLastCharPos() < inputstring.length())
					throw new ParseException(this, true, "Parsing succeeded, but not all input was consumed ");

				if (Miniup.SHOWSTATS)
					System.out.println(string.format("Finished parsing in %d ms. Stats: %d/%d/%d/%d/%d (read attempts/successfull reads/failed reads/cache hits/cache misses)",
							(new Date().getTime()) - start, calls, found, notfound, memoizer.cachehits, memoizer.cachemisses));
				return m;
			}

			public consume : bool(Match parent, token:string) {}{
				stack.push(Pair.pair(token, 0));
				int curpos = parent.getLastCharPos();
			 result : bool = false;

				if (Miniup.VERBOSE)
					System.out.println(string.format("[%s:%s]%s", getCurrentLineNr(curpos), getCurrentColNr(curpos), Util.leftPad(token + " ?", stack.size())));
				this.calls += 1;

				try {
					if (language.getMaxRecursionDepth() != -1 && stack.size() > language.getMaxRecursionDepth())
						throw new ParseException(this, false, "Maximum stack depth reached. ");

					AbstractMatcher matcher = language.getMatcher(token);
					this.storeExpected(matcher, parent, curpos);

					if (memoizer.isInCache(curpos, matcher)) {
						result = memoizer.consumeFromCache(parent, token, curpos);

						if (result)
							consumeWhitespace(parent);
					}

						//not in cache {
					else {
						if (matcher.match(this, parent)) {
							memoizer.storeInCache(parent, curpos, matcher);

							consumeWhitespace(parent);

							result = true;
						}
						else
							memoizer.storeInCache(null, curpos, matcher);
					}

					if (Miniup.VERBOSE && result)
						System.out.println(string.format("[%s:%s]%s", getCurrentLineNr(curpos), getCurrentColNr(curpos), Util.leftPad(token + " V", stack.size())));
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
						stack.pop();
					}
				}

				private consumeWhitespace(Match parent) {}{
					if (language.getDisableAutoWhitespace())
						return;

				 res : bool = true;
					int curpos = parent.getLastCharPos();

					while (res) {
						res = false;
						for (TokenMatcher wsMatcher: language.getWhiteSpaceTokens()) {
							if (memoizer.isInCache(curpos, wsMatcher))
								res = memoizer.consumeFromCache(parent, wsMatcher.getName(), curpos);
							else
								res = wsMatcher.match(this, parent);
							if (res)
								break;
						}
					}
				}

				public consumeLambda(Match parent, token:string) {
					Match match = new Match(this, parent, null);
					match.setNil(token);

					if (Miniup.VERBOSE)
						System.out.println(Util.leftPad("-", stack.size()));
				}

				public getInputString:string() {
					return this.inputstring;
				}

				@SuppressWarnings("unchecked")
				private storeExpected(AbstractMatcher matcher, Match parent, int curpos) {
					if (curpos > bestPoint) {
						bestPoint = curpos;
						bestStack = (Stack < Pair < string, Integer >>) stack.clone();
						expected.clear();
					}
					if (matcher instanceof TokenMatcher && curpos >= bestPoint) {
						expected.add(matcher.getName());
					}
				}

				public setStackIter(int index) {
					stack.push(Pair.pair(stack.pop().getFirst(), index));
				}

				public int getCurrentLineNr(int curpos) {
					if (curpos == -1)
						return -1;

				 input:string = getInputString().substring(0, curpos);
					int line = 1 + Util.countMatches(input, "\n");
					return line;
				}

				public int getCurrentColNr(int curpos) {
					if (curpos == -1)
						return -1;

				 input:string = getInputString().substring(0, curpos);
					int last = input.lastIndexOf('\n');
					int col = input.length() - last;
					return col;
				}

				public getCurrentInputLine:string(int curpos) {
				 input:string = getInputString();
					return Util.getInputLineByPos(input, curpos);
				}


			}



			export class TestSuite {

		public static runTestsuite() {}{
			test1();
			test2();
			test3();
			test4();
			//System.exit(0);
			Grammar b = GrammarBuilder.createBootstrapper();

			//run sugar test
			GrammarBuilder.languageFromAST(Grammar.get("Miniup").parse(Util.readFileAsString("res/sugartest.txt")).toAST());

			Node n = Grammar.get("sugartest").parse(
				"sublist bla boe > subchoice 'hoi' subcomp zeker"
			).toAST();

			test(n.toString(),
			"(test (subrule_1 'bla' 'boe') ''hoi'' (subrule_3 - 'zeker'))");

			test(n.get("jatoch").findText(1), "zeker");
			test(n.get("ids").toString(), "(subrule_1 'bla' 'boe')");
			test(n.get("string").text(), "'hoi'");

			//load Miniup from the official def, should behave the same..
		 data:string;
			data = Util.readFileAsString("res/miniup.txt");

			//test bootstrap
			Match m = b.parse(data);

			Node t = m.toAST();
			System.out.println(t);
			Grammar b2 = GrammarBuilder.languageFromAST(t);

			//try to parse ourselves a few times... that makes a nice unit test
			for (int i = 0; i < 3; i++) {
				System.out.println("Yeaah, parsed for the " + (i + 1) + " time");
				m = b2.parse(data);
				t = m.toAST();
				b2 = GrammarBuilder.languageFromAST(t);
			}

			//Match m = b.parse(data);
			//System.out.println(m);

			GrammarBuilder.languageFromAST(Grammar.get("Miniup").parse(Util.readFileAsString("res/sugartest.txt")).toAST());

			n = Grammar.get("sugartest").parse(
				"sublist bla boe > subchoice 'hoi' subcomp zeker"
			).toAST();

			test(n.toString(),
			"(test (subrule_1 'bla' 'boe') ''hoi'' (subrule_3 - 'zeker'))");

			test(n.get("jatoch").findText(1), "zeker");
			test(n.get("ids").toString(), "(subrule_1 'bla' 'boe')");
			test(n.get("string").text(), "'hoi'");

			System.out.println("Finished!");
		}


			@SuppressWarnings("unused")
			private static test1() {}{
			 data:string = Util.readFileAsString("res/test1.txt");

				Grammar bootstrap = new Grammar("test1");
				bootstrap.addTokenmatcher("identifier", "\\w+", false);
				bootstrap.addTokenmatcher("whitespace", "\\s+", true);
				bootstrap.addTokenmatcher("number", "\\d+", true);
				bootstrap.keyword("bla");
				bootstrap.keyword("bla");
				bootstrap.keyword(">=");
				bootstrap.keyword("==");
				bootstrap.keyword(">");
				bootstrap.keyword("=");
			}

			private static test2() {}{

				Grammar x = new Grammar("test2");
			 ID:string = "identifier";
				x.addTokenmatcher("identifier", "\\w+", false);
				x.addTokenmatcher("whitespace", "\\s+", true);
				x.addTokenmatcher("number", "\\d+", true);

				SequenceMatcher hw = x.addSequence("hw", new SequenceItem(ID), new SequenceItem(ID, false));

				x.setStartSymbol(hw.getName());
				Match m = x.parse("hello");
				test(m.toMatchString(), "(hw: 'hello' -)");

				Match m2 = x.parse("hello world");
				test(m2.toMatchString(), "(hw: 'hello' 'world')");

			 o:string = x.keyword("other");
			 p:string = x.keyword("planet");
				x.setStartSymbol(x.addChoice("op", o, p));
				test(x.parse("  planet  \n").toMatchString(), "(op: planet)");

				x.setStartSymbol(x.addList("list1", true, ID, null, o, p, true));
				test(x.parse("other planet").toMatchString(), "(list1: other planet)");
				test(x.parse("other blaat blaat planet").toMatchString(), "(list1: other 'blaat' 'blaat' planet)");

				x.setStartSymbol(x.addList("list2", true, ID, x.keyword(","), o, p, true));
				// test(x.parse("other planet").toAST().toString(),"(list2 (list2))");
				test(x.parse("other hoi , hoi planet").toAST().toString(), "(list2 'hoi' 'hoi')");
				test(x.parse("other hoi , hoi, planet").toAST().toString(), "(list2 'hoi' 'hoi')");
				test(x.parse("other oi,planet").toMatchString(), "(list2: other 'oi' , planet)");
				test(x.parse("other blaat, blaat planet").toMatchString(), "(list2: other 'blaat' , 'blaat' planet)");

				x.addList("planets", true, "identifier", null, null, null, false);
				x.addSequence("emptyListEOF", new SequenceItem("identifier"), new SequenceItem("planets"));
				//MWE: bug found: this should not throw EOF!
				test(x.parse("bladibla", "emptyListEOF").toMatchString(), "(emptyListEOF: 'bladibla' (planets:))");

			}

			private static test3() {}{
				//language without backtracking
				Grammar x = new Grammar("test3");
				x.addTokenmatcher("whitespace", "\\s+", true);
			 Number:string = "number";
				x.addTokenmatcher("number", "\\d+", false);

			 mul:string = x.addOperator("mul", true, x.keyword("*"), Number);
			 add:string = x.addOperator("add", false, x.keyword("+"), mul);
			 Expr:string = x.addChoice("expr", add);
				x.setStartSymbol(Expr);

				/*      test(x.parse("1 * 2").toMatchString(), "(expr: (add: (mul: '1' * '2')))");
					  test(x.parse("1 * 2 * 3").toMatchString(), "(expr: (add: (mul: '1' * '2' * '3')))");
					  test(x.parse("1 + 2 + 3").toMatchString(), "(expr: (add: (mul: '1') + (add: (mul: '2') + (add: (mul: '3')))))");
					  test(x.parse("1 * 2 + 3 * 4").toMatchString(), "(expr: (add: (mul: '1' * '2') + (add: (mul: '3' * '4'))))");
					  test(x.parse("1 + 2 + 3 * 4 * 5 * 6").toMatchString(), "(expr: (add: (mul: '1') + (add: (mul: '2') + (add: (mul: '3' * '4' * '5' * '6')))))");
				 */
				test(x.parse("1 * 2").toAST().toString(), "(mul '*' '1' '2')");
				test(x.parse("1 * 2 * 3").toAST().toString(), "(mul '*' (mul '*' '1' '2') '3')");
				test(x.parse("1 + 2 + 3").toAST().toString(), "(add '+' '1' (add '+' '2' '3'))");
				test(x.parse("1 * 2 + 3 * 4").toAST().toString(), "(add '+' (mul '*' '1' '2') (mul '*' '3' '4'))");
				test(x.parse("1 + 2 + 3 * 4 * 5 * 6").toAST().toString(), "(add '+' '1' (add '+' '2' (mul '*' (mul '*' (mul '*' '3' '4') '5') '6')))");
				test(x.parse("1 + 2 + 3 * 4 * 5 + 6 * 2 + 7").toAST().toString(), "(add '+' '1' (add '+' '2' (add '+' (mul '*' (mul '*' '3' '4') '5') (add '+' (mul '*' '6' '2') '7'))))");
			}

			private static test4() {}{
				//language with backtracking
				Grammar x = new Grammar("test4");
				x.setBacktracking(50);
				x.addTokenmatcher("whitespace", "\\s+", true);
			 Number:string = "number";
				x.addTokenmatcher("number", "\\d+", false);

			 mul:string = x.addOperator("mul", true, x.keyword("*"), "expr");
			 add:string = x.addOperator("add", false, x.keyword("+"), "expr");
				x.addSequence("paren",
						new SequenceItem(x.keyword("(")),
						new SequenceItem("expr"),
						new SequenceItem(x.keyword(")")));
			 Expr:string = x.addChoice("expr", add, mul, Number, "paren");
				x.setStartSymbol(Expr);
				//TODO: matchstring depends on stack, how to optimize?
				//      test(x.parse("1 * 2").toMatchString(), "(expr: (mul: (expr: '1') * (expr: '2')))");
				//      test(x.parse("1 + 2 + 3 * 4 * 5 * 6").toMatchString(), "(expr: (add: (mul: '1') + (add: (mul: '2') + (add: (mul: '3' * '4' * '5' * '6')))))");

				//     test(x.parse("1 * 2").toAST().toString(), "(expr (mul '*' '1' '2'))");
				//        test(x.parse("1 * 2 * 3").toAST().toString(), "(expr (mul '*' (mul '*' '1' '2') '3'))");
				test(x.parse("1 + 2 + 3").toAST().toString(), "(add '+' '1' (add '+' '2' '3'))");
				test(x.parse("1 + 2 + 3 * 4 * 5 * 6").toAST().toString(), "(add '+' '1' (add '+' '2' (mul '*' (mul '*' (mul '*' '3' '4') '5') '6')))");
				test(x.parse("1 + 2 + 3 * 4 * 5 + 6 * 2 + 7").toAST().toString(), "(add '+' '1' (add '+' '2' (add '+' (mul '*' (mul '*' '3' '4') '5') (add '+' (mul '*' '6' '2') '7'))))");

				test(x.parse("(1 + 2) + 3").toAST().toString(), "(add '+' (paren (add '+' '1' '2')) '3')");

				test(x.parse("1 + (2 + 3) * 4 * (5 * 6)").toAST().toString(),
				"(add '+' '1' (mul '*' (mul '*' (paren (add '+' '2' '3')) '4') (paren (mul '*' '5' '6'))))");
				test(x.parse("(1 + 2) * 3 + 4 * (5 + 6) + (6 + 7) * 8").toAST().toString(),
						"(add '+' (mul '*' (paren (add '+' '1' '2')) '3') (add '+' (mul '*' '4' (paren (add '+' '5' '6'))) (mul '*' (paren (add '+' '6' '7')) '8')))");

			}

			//TODO: add test for SetMatcher
			//TODO: add test for endless recursion and list lambda productions
			private static test(string ast, string:string) {
				System.out.println(ast);
				if (!ast.trim().equals(string))
					throw new AssertionError("TEST FAILED: Expected:\n" + +:string "\n\nReceived:\n\n" + ast);
			}
		}




		public abstract class AbstractMatcher {

		protected name:string;
		protected Grammar language;
		private Map <string, Object > options = new HashMap < string, Object >();

		public AbstractMatcher(Grammar language, name:string) {
			this.name = name;
			this.language = language;
		}

			public match : bool(Parser parser, Match parent) {}{
				//if (parent.getLastCharPos() >= parser.getInputString().length()) //EOF
				//    return false;
				Match match = new Match(parser, parent, this);
				if (!this.performMatch(parser, match)) {
					parent.unMatch();
					return false;
				}

				return true;
			}

			abstract performMatch : bool(Parser parser, Match parent) {}

			public getName:string() { return name; }
			public Grammar getLanguage() { return language; }

			public toString:string() { return "Matcher: " + this.getName(); }

			abstract public Node toAST(Match match);

			public setOption(string key, Object object) {
				this.options.put(key, object);
			}

			public Object getOption(string key, Object defaultvalue) {
				if (this.options.containsKey(key))
					return options.get(key);
				return defaultvalue;
			}
		}




		export class ChoiceMatcher extends AbstractMatcher {

		public ChoiceMatcher(Grammar language, name:string, string[]items) {
			super(language, name);
			for (string item: items)
				this.choices.add(item);
		}

			List < >:string choices = new ArrayList < >:string ();

			@Override
		 performMatch : bool(Parser parser, Match parent) {}{
				int index = 0;
				for (string choice: choices) {
					parser.setStackIter(index++);
					if (parser.consume(parent, choice))
						return true;
				}
				return false;
			}

			@Override
			public Node toAST(Match match) {
				Node inner = match.getLastMatch(true).toAST();
				if (Boolean.FALSE.equals(this.getOption("wrap", Boolean.FALSE))) //nowrap?
					return inner;

				return new Node(this.getName(), inner);
			}

		}


		export class ImportMatcher extends AbstractMatcher {

		private languagename:string;
		private rulename:string;

		public ImportMatcher(Grammar language, name:string, languagename:string, rulename:string) {
			super(language, name);
			this.languagename = languagename;
			this.rulename = rulename;
		}

			@Override
		 performMatch : bool(Parser parser, Match parent) {}{
				if (!Grammar.languages.containsKey(languagename))

				try {
					return Grammar.get(languagename).parsePartial(parser, parent, rulename);
				}
				catch (ParseException inner) {
					//TODO: wrap exception? calculate real coordinates?
					throw inner;
				}
			}

			@Override
			public Node toAST(Match match) {
				Node inner = match.getLastMatch(true).toAST();
				if (Boolean.FALSE.equals(this.getOption("wrap", Boolean.TRUE))) //nowrap?
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

		public ListMatcher(Grammar language, name:string, token:string, seperator:string, pre:string, post:string) {
			super(language, name);
			this.token = token;
			this.seperator = seperator;
			this.pre = pre;
			this.post = post;
		}

			@Override
		 performMatch : bool(Parser parser, Match parent) {}{
				//match pre token
				if (pre != null) {
					if (!parser.consume(parent, pre))
						return false;
				}
				int index = 0;
				int basepos = -1;

				if (post != null && parser.consume(parent, post))
					return this.isNullable();

				if (parser.consume(parent, token)) {
					while (seperator == null || parser.consume(parent, seperator)) {
						//detect lambda matching lists...
						if (parent.getLastCharPos() <= basepos)
							throw new ParseException(parser, false, "The rule '" + this.name + "', never ends, its items ('" + token + "') can match an empty string");

						basepos = parent.getLastCharPos();
						parser.setStackIter(++index);

						//something has been consumed, assert that it is not empty, otherwise we end up in an endless loop
						//if (seperator == null && parent.getLastMatch(true).charsConsumed() == 0)
						//	throw new ParseException(parser, false, "Unterminating match detected. List items should either consume terminals or be seperated.");

						if (post != null && parser.consume(parent, post))
							return seperator == null || this.allowTrailing();

						if (!parser.consume(parent, token)) {
							return post == null; //we should have read post already otherwise
						}
					}
					return post == null || parser.consume(parent, post);
				}
				//nothing matched yet..
				return this.isNullable() && (post == null || parser.consume(parent, post));
			}

			public allowTrailing : bool() {
				return (Boolean) getOption(ALLOWTRAILING_OPTION, Boolean.FALSE);
			}

			public isNullable : bool() {
				return (Boolean) getOption(NULLABLE_OPTION, Boolean.TRUE);
			}

			@Override
			public Node toAST(Match match) {
				List < Node > children = new Vector < Node > ();
			 hasPre : bool = pre != null;
			 hasSep : bool = seperator != null;
			 hasPost : bool = post != null;
				for (int i = 0; i < match.subMatchCount(true); i++) {
					if (i == 0 && hasPre)
						continue;
					if (i == match.subMatchCount(true) - 1 && hasPost)
						continue;
					if (hasSep && i % 2 == (hasPre ? 0 : 1))
						continue;
					if (!match.getSubMatch(i, true).getMatchedBy().getName().equals(seperator))
						children.add(match.getSubMatch(i, true).toAST());
				}
				return new Node(this.name, children);
			}
		}




		export class OperatorMatcher extends AbstractMatcher {

		private operand:string;
		private operator:string;

		public static final RIGHT_OPTION:string = "right";

		public OperatorMatcher(Grammar language, name:string, leftassociative : bool, operator:string, operand:string) {
			super(language, name);
			this.operand = operand;
			this.operator = operator;
			if (!leftassociative)
				setOption(RIGHT_OPTION, Boolean.TRUE);
		}

			@Override
		 performMatch : bool(Parser parser, Match parent) {}{
				//left : a = b (op b)*
				// if (this.getIsLeftAssociative()) {
				if (isRepeatingState(parent)) //force backtrack for operators we already tried.
					return false;

				if (!parser.consume(parent, operand))
					return false;
				while (parser.consume(parent, operator)) {
					if (!parser.consume(parent, operand))
						return false;
				}
				return true;
				/*    }
					//right: a = b (op a)?
					else {
						if (isRepeatingState(parent)) //force backtrack for operators we already tried.
							return false;
						if (!parser.consume(parent, operand))
							return false;
						if (parser.consume(parent, operator)) {
							return parser.consume(parent, this.getName());
						}
						return true;
					}
			*/
			}

			/**
			 * The general idea behind this method that an operator cannot be matched if its already in the current parse
			 * stack, unless some other input has been consumed, in which case a new 'expression' is needed
			 * @param parent
			 * @return
			 * @{
			 */
			private isRepeatingState : bool(Match parent) {}{
				Match p = parent.getParentMatch();
				while (p != null && p.getMatchedBy() != null) {
					AbstractMatcher matcher = p.getMatchedBy();

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

			public getIsLeftAssociative : bool() {
				return !((Boolean) this.getOption(RIGHT_OPTION, Boolean.FALSE));
			}

			@Override
			public Node toAST(Match match) {
				List < Match > matches = match.getSubMatches();
				return toASTNodeHelper(matches);
			}

			private Node toASTNodeHelper(List < Match > matches) {
				List < Node > children = new Vector < Node > ();
				int size = matches.size();
				if (size == 3) {
					children.add(matches.get(1).toAST());
					children.add(matches.get(0).toAST());
					children.add(matches.get(2).toAST());
				}
				else if (size == 1) {
					return (matches.get(0).toAST());
				}
				else if (getIsLeftAssociative()) {
					children.add(matches.get(size - 2).toAST());
					children.add(toASTNodeHelper(matches.subList(0, size - 2)));
					children.add(matches.get(size - 1).toAST());
				}
				else {
					children.add(matches.get(1).toAST());
					children.add(matches.get(0).toAST());
					children.add(toASTNodeHelper(matches.subList(2, size)));
				}
				return new Node(this.name, children);
			}

		}




		export class SequenceMatcher extends AbstractMatcher {
		public static class SequenceItem {
		private item:string;
		private required : bool;
		private name:string;

		public SequenceItem(string item) {
			this.item = item;
			this.required = true;
			this.name = null;
		}

			public SequenceItem(string item, required : bool) {
				this.item = item;
				this.required = required;
				this.name = null;
			}

			public SequenceItem(string item, required : bool, name:string) {
				this.item = item;
				this.required = required;
				this.name = name;
			}
		}

		public SequenceMatcher(Grammar language, name:string) {
			super(language, name);
		}

			List < SequenceItem > toMatch = new Vector < SequenceItem > ();;

			@Override
		 performMatch : bool(Parser parser, Match parent) {}{
				for (int i = 0; i < toMatch.size(); i++) {
					parser.setStackIter(i);
					SequenceItem item = toMatch.get(i);
					if (parser.consume(parent, item.item))
						continue;
					if (item.required)
						return false;
					parser.consumeLambda(parent, item.item);
				}
				return true;
			}

			public addItem(SequenceItem item) {
				toMatch.add(item);
			}

			@Override
			public Node toAST(Match match) {
				List < Node > children = new Vector < Node > ();
				Map < string, Node > childMap = new HashMap < string, Node > ();

				for (int i = 0; i < match.subMatchCount(true); i++) {
					if (toMatch.get(i).required == false ||
						!(match.getSubMatch(i, true).getMatchedBy() instanceof TokenMatcher) ||
						!((TokenMatcher) match.getSubMatch(i, true).getMatchedBy()).isKeyword()) {

							Node child = match.getSubMatch(i, true).toAST();
							children.add(child);
						 name:string = toMatch.get(i).name;
							if (name != null && !name.isEmpty())
								childMap.put(name, child);
						}
				}
				return new Node(this.name, children, childMap);
			}





		export class SetMatcher extends AbstractMatcher {

		private seperator:string;
		private List <string > items;
		private pre:string;
		private post:string;

		public SetMatcher(Grammar language, name:string, seperatorOrNull:string, preOrNull:string, postOrNull:string, string...items) {
			super(language, name);
			this.seperator = seperatorOrNull;
			this.pre = preOrNull;
			this.post = postOrNull;
			this.items = Arrays.asList(items);
		}

			@Override
		 performMatch : bool(Parser parser, Match parent)
					{}{
						if (pre != null && !parser.consume(parent, pre))
							return false;

						List < >:string available = new Vector < >:string (items);
					 matched : bool = true;
					 sepmatched : bool = false;
						while (!available.isEmpty() && matched) {
							matched = false;
							for (string token: available) {
								if (parser.consume(parent, token)) {
									available.remove(token);
									matched = true;
									if (seperator == null)
										break;
									else
										sepmatched = parser.consume(parent, seperator);
								}
							}
						}
						if (sepmatched) //there was a trailing seperator!
							return false;

						return post == null || parser.consume(parent, post);
					}

			@Override
			public Node toAST(Match match) {
				List < Node > children = new Vector < Node > ();
			 hasPre : bool = pre != null;
			 hasSep : bool = seperator != null;
			 hasPost : bool = post != null;
				for (int i = 0; i < match.subMatchCount(true); i++) {
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




		export class TokenMatcher extends AbstractMatcher {
		public static enum BuiltinToken {
		IDENTIFIER("[a-zA-Z_][a-zA-Z_0-9]*", false),
		WHITESPACE("\\s+", true),
		INTEGER("-?\\d+", false),
		FLOAT("-?\\d+(\\.\\d+)?(e\\d+)?", false),
		SINGLEQUOTEDSTRING("'(?>[^\\\\']|(\\\\[btnfr\"'\\\\]))*'", false),
		DOUBLEQUOTEDSTRING("\"(?>[^\\\\\"]|(\\\\[btnfr\"'\\\\]))*\"", false),
		SINGLELINECOMMENT("//[^\\n]*(\\n|$)", true),
		MULTILINECOMMENT("/\\*(?:.|[\\n\\r])*?\\*/", true),
		BOOLEAN("true|false", false),
		REGULAREXPRESSION("/(?>[^\\\\/]|(\\\\.))*/", false);

			private regexp:string;
			private whitespace : bool;

			BuiltinToken(string regexp, whitespace : bool) {
				this.regexp = regexp;
				this.whitespace = whitespace;
			}

			public TokenMatcher registerTokenMatcher(Grammar language) {}{
				return (TokenMatcher) language.addTokenmatcher(this.toString(), regexp, this.whitespace);
			}
		};

		/**
		 * Takes a willed arsed quess to confert a tokens text to a native java primitive, tries
		 * - 		 * : bool" - long
		 * - float
		 * - quoted 		 *:string - javascript style regex
		 * - return original input
		 * @param input
		 * @return
		 */
		public static Object textToValue(string input) {
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


			private Pattern regexp;
			private isWhiteSpace : bool;
			private isKeyword : bool;
			private keyword:string;

			public TokenMatcher(Grammar language, name:string, regexp:string, whiteSpace : bool) {
				super(language, name);
				this.regexp = Pattern.compile("\\A" + regexp, Pattern.MULTILINE &
					(language.getCaseInSensitive() ? Pattern.CASE_INSENSITIVE : 0)
				);
				this.isWhiteSpace = whiteSpace;
			}

			public Token match(string input) {
				//System.out.println("About to match " + this.name + this.language.getName() + regexp.pattern());
				Matcher m = regexp.matcher(input);
				if (!m.find())
					return null;

			 text:string = input.substring(0, m.end());

				return new Token(this, text);
			}

			public isWhiteSpace : bool() {
				return isWhiteSpace;
			}

			@Override
		 performMatch : bool(Parser parser, Match parent) {
				int curpos = parent.getLastCharPos();
			 rest:string = parser.getInputString().substring(curpos);
				Token next = this.match(rest);

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

			public getName:string() {
				return name;
			}

			public toString:string() {
				return string.format("[TokenMatcher '%s'->%s]", regexp.pattern(), this.name);
			}

			public getRegexp:string() {
				return regexp.pattern();
			}

			/** indicates that this is a generated token, which should not be included in output etc */
			public setIsKeyword(string keyword) {
				this.keyword = keyword;
				this.isKeyword = true;
			}

			public getKeyword:string() { return keyword; }

			public isKeyword : bool() {
				return this.isKeyword;
			}

			@Override
			public Node toAST(Match match) {
				return new Node(this.name, match.getTerminal());
			}


		}



		export class CLI {


		private static Queue <string > mainArguments = new LinkedList < >:string ();

		/**
		 * Processes command line arguments. Use the help command to find out which commands are available
		 * @param args
		 * @{
		 */
		public static main(string[]args) {}{
			for (int i = 0; i < args.length; i++)
				mainArguments.add(args[i]);

		 showOutput : bool = false;
		 input:string = null;
		 language:string = null;
		 startSymbol:string = null;
			long start = System.currentTimeMillis();

			while (!mainArguments.isEmpty()) {
			 cmd:string = mainArguments.poll();
				if ("-T".equals(cmd)) {
					Miniup.bootstrap();
					TestSuite.runTestsuite();
				}
				else if ("-v".equals(cmd))
					Miniup.VERBOSE = true;
				else if (("-h").equals(cmd))
					printHelp();
				else if ("-o".equals(cmd))
					showOutput = true;
				else if ("-i".equals(cmd))
					input = Util.readFileAsString(mainArguments.poll());
				else if ("-t".equals(cmd))
					input = mainArguments.poll();
				else if ("-g".equals(cmd))
					language = mainArguments.poll();
				else if ("-S".equals(cmd))
					Miniup.SHOWSTATS = true;
				else if ("-c".equals(cmd))
					Miniup.USE_TOKEN_MEMOIZATION = true;
				else if ("-s".equals(cmd))
					startSymbol = mainArguments.poll();
				else if ("-l".equals(cmd)) {
				 lib:string = mainArguments.poll();
					Miniup.loadLanguageFromFile(lib);
					p("  Loaded grammar as library: " + lib);
				}
				else
					throw new IllegalArgumentException("Unknown option: '" + cmd + "'");
			}

			if (input != null) {
				System.out.println("Preparing parse");

				if (language == null) {
					Miniup.bootstrap();
					language = "Miniup";
				}
				else
					language = Miniup.loadLanguageFromFile(language);

				System.out.println("Loaded language '" + language + "'");

				Node node = Miniup.parse(language, input, startSymbol);

				System.out.println("Parse succeeded :)");

				if (showOutput)
					System.out.println(node.toMultilineString());

			}
			if (Miniup.SHOWSTATS)
				System.out.println("Total time: " + (System.currentTimeMillis() - start) + " ms.");

			System.exit(0);
		}

			private static p(string s) {
				System.out.println(s);
			}

			private static p(string flag, arg:string, help:string) {
				System.out.print("\t-");
				System.out.print(flag);
				System.out.print("\t");
				if (arg != null)
					System.out.print("[" + arg + "]");
				else
					System.out.print("\t");
				System.out.print("\t");
				p(help);
			}

			private static printHelp() {
				p("Miniup parsing library CLI version 1.0");
				p("Written by Michel Weststrate, 2012, michel@mweststrate.nl");
				p("Vist the project at http://[githuburl]"); //TODO:
				p("");
				p("Command line arguments:");
				p("g", "filename", "Parse using the grammar definition defined in [filename]");
				p("i", "filename", "Use the given file as input for the parser");
				p("");
				p("c", null, "Use token memoization, might increase the parse speed at the cost of memory consumption");
				p("h", null, "Prints this help message");
				p("l", "filename", "Loads an additional grammar definition, to be able to resolve 'import' rules");
				p("o", null, "Prints the AST created by the parser to stdout");
				p("s", "rulename", "Use the given rulename as start symbol while parsing");
				p("S", null, "Print statistics after the parsing has finished");
				p("t", "sometext", "Use the provided text as input for the parser");
				p("T", null, "Run the internal test suite");
				p("v", null, "Verbose mode. Prints all match attemps of the parser to stdout");
			}
		}

		/**
		 * A pair of things, useful in a language that doesn't contain tuples...
		 *
		 * Probably grabbed it from somewhere of the internetz..
		 *
		 * @author michel
		 *
		 * @param <A>
		 * @param <B>
		 */
		export class Pair <A, B > {
		private final A first;
		private final B second;

		public Pair(A first, B second) {
			this.first = first;
			this.second = second;
		}

			public static <C, D > Pair < C, D > pair(C first, D second) {
				return new Pair < C, D > (first, second);
			}

			public int hashCode() {
				int hashFirst = first != null ? first.hashCode() : 0;
				int hashSecond = second != null ? second.hashCode() : 0;

				return (hashFirst + hashSecond) * hashSecond + hashFirst;
			}

			@SuppressWarnings("unchecked")
			public equals : bool(Object other) {
				if (other instanceof Pair) {
					Pair < A, B > otherPair = (Pair < A, B >) other;
					return
					((this.first == otherPair.first ||
							(this.first != null && otherPair.first != null &&
							  this.first.equals(otherPair.first))) &&
					 (this.second == otherPair.second ||
							(this.second != null && otherPair.second != null &&
							  this.second.equals(otherPair.second))));
				}

				return false;
			}

			public toString:string()
			{
				return "(" + first + ", " + second + ")";
			}

			public A getFirst() {
				return first;
			}

			public B getSecond() {
				return second;
			}

			public Pair < A, B > clone() {
				return Pair.pair(first, second);
			}


		/**
		 * Some utility functions used by the parsers. You might find similar methods, probably faster, in apache commons.
		 * Those are here just to make the parser dependency free.
		 * @author michel
		 *
		 */
		export class Util {

		/**
		 * Given a filename, returns it contents as 		 *:string @param filePath
		 * @return
		 * @{
		 */
		public static readFileAsString:string(string filePath) {}{
			byte[]buffer = new byte[(int) new File(filePath).length()];
			BufferedInputStream f = new BufferedInputStream(new FileInputStream(filePath));
			f.read(buffer);
			return new string(buffer);
		}

			/**
			 * If idx is positive, returns the substring starting at the index, otherwise, return the substring ending at that index
			 * @param base
			 * @param idx
			 * @return
			 */
			public static substring:string(string base, int idx) {
				if (idx >= 0)
					return substring(base, idx, 0);
				return substring(base, 0, idx);
			}

			/**
			 * Substring implementation that never {
			 *
			 * if input: "miniup"
			 *
			 * 0 (,0)  -> "miniup"
			 * 2 (,0)  -> "niup"
			 * 4, 2    -> "up"
			 * (0,) -2 -> "mini"
			 * 1, -2   -> "ini"
			 * -1, -2  -> "i"
			 * -1, 6   -> "p"
			 * @param base basestring to get a substring from
			 * @param fromleft if positive, start index; if negative, length:string
			 * @param fromright if negative, amount of characters from the end, if positive, length:string
			 * @return
			 */
			public static substring:string(string base, int fromidx, int toidx) {
				int from = fromidx;
				int len = base.length();
				int to = toidx;

				if (from == 0 && to == 0)
					to = len;
				else if (from >= 0 && to <= 0)
					to = len + to;
				else if (from >= 0 && to > 0)
					to = from + to;
				else if (from < 0 && to < 0) {
					to = len + to;
					from = to + from;
				}
				else if (from < 0 && to >= 0)
					from = to + from;
				else
					throw new RuntimeException("Unimplemented substring case: " + fromidx + ", " + toidx);

				from = Math.max(from, 0);
				to = Math.max(from, Math.min(to, len));

				return base.substring(from, to);
			}

			public static leftPad:string(string string, int col) {
				int v = col;
			 r:string = "";
				while (v-- > 0)
					r += " ";
				return r + string;
			}

			public static join:string(Collection < >:string stuff, separator:string) {
				StringBuilder b = new StringBuilder();
				int i = 0;
				for (string item: stuff) {
					b.append(item);
					if (i < stuff.size() - 1)
						b.append(separator);
					i++;
				}
				return b.toString();
			}

			public static int countMatches(string input, needle:string) {
				int r = 0;
				int p = 0;
				int i = 0;
				while ((i = input.indexOf(needle, p)) != -1) {
					p = i + 1;
					r++;
				}
				return r;
			}

			public static unescape:string(string text) {
				//naive unescape function..
				return text.replaceAll("\\\b", "\b")
					.replaceAll("\\\t", "\t")
					.replaceAll("\\\n", "\n")
					.replaceAll("\\\f", "\f")
					.replaceAll("\\\r", "\r")
					.replaceAll("\\\\", "\\")
					.replaceAll("\\'", "'")
					.replaceAll("\\\"", "\"");
			}


			public static trimToLength:string(string string, int maxlength) {
				if (string == null || string.length() < maxlength)
					return string;
				return string.substring(0, maxlength);
			}

			public static getInputLineByPos:string(string input, int position) {
				int prev = input.lastIndexOf('\n', position);
				int next = input.indexOf('\n', position);
			 line:string = Util.substring(input, prev + 1, Math.min(position + 20, next - prev));
				return line.replaceAll("\t", " ");
			}

			public static getInputLine:string(string input, int nr) {
				int cur = -1;
				for (int i = nr; i > 1; i--) {
					cur = input.indexOf('\n', cur + 1);
					if (cur == -1)
						return null;
				}

				int next = input.indexOf('\n', cur + 1);
			 line:string;
				if (next == -1)
					line = input.substring(cur + 1);
				else
					line = input.substring(cur + 1, next);

				return line.replaceAll("\t", " "); //to fix highlighting for tabs. Better would be to insert a tabs before the cursor if needed
			}

			public static hightlightLine:string(string inputString, int linenr,
					int colnr) {
					 msg:string = "at line " + linenr + " column " + colnr + ":\n\n";
						msg += getInputLine(inputString, linenr) + "\n";
						msg += Util.leftPad("^", colnr - 1);
						return msg;
					}
		}
	}
}