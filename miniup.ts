package nl.mweststrate.miniup;

/**
 * This interface can be passed to @see Node.walk,
 * which traverses the Node tree in depth first order, calling @see hit for each Node it encounters.
 * @author michel
 *
 */
public interface INodeWalker {
	/**
	 * Event which is called when the walker encounters a node. Should return true if the walker is allowed to continue, or false if it should break
	 * @param node
	 * @return
	 */
	boolean hit(Node node);
}
package nl.mweststrate.miniup;

import java.io.IOException;

import nl.mweststrate.miniup.core.Grammar;
import nl.mweststrate.miniup.core.GrammarBuilder;
import nl.mweststrate.miniup.core.GrammarDefinitionException;
import nl.mweststrate.miniup.core.ParseException;
import nl.mweststrate.miniup.util.Util;


public class Miniup {

	/**
	 * Public flag, if enabled, token memoization is enabled. This increases the member consumption of the parser,
	 * but might reduce the parse speed for grammars that are diffucult to parse. 
	 */
	public static boolean USE_TOKEN_MEMOIZATION = false;

	/**
	 * Public flag, if enabled, the full parse flow will be printed to stdout.
	 */
    public static boolean VERBOSE = false;
    
    /**
     * Public flag, if enabled, after each successful parse Miniup will show some statistics about the parse process,
     * for example the parse time, the number of items matched and the number of items tried but not matched.
     * For each number holds: Lower is better. 
     */
	public static boolean SHOWSTATS = true;

	/**
	 * Given a filename, the grammar in the file is parsed and a new grammar is build or an exception is trown. 
	 * 
	 * @param filename, the file to load
	 * @return the name of the grammar. Use this name for subsequent parse calls. 
	 * @throws GrammarDefinitionException
	 * @throws IOException
	 */
	public static String loadLanguageFromFile(String filename) throws GrammarDefinitionException, IOException {
		return loadLanguage(Util.readFileAsString(filename));
	}

	/**
	 * Makes sure that there is a grammar that can read grammars, to enable Miniup to read other grammars. Internally used when a new language needs to be parsed.
	 * @throws GrammarDefinitionException
	 */
	public static void bootstrap() throws GrammarDefinitionException {
		if (Grammar.languages.containsKey("Miniup"))
			return;
		try {
        	Grammar bootstrapper = GrammarBuilder.createBootstrapper();
        	bootstrapper.register();
        	
        } catch (Exception e) {
            throw new GrammarDefinitionException("Severe exception: failed to bootstrap the Miniup language!",e);
        }
	}
    
	/**
	 * Parses a grammar from a string.
	 * @param langDef
	 * @return The name of the language
	 * @throws GrammarDefinitionException
	 */
    public static String loadLanguage(String langDef) throws GrammarDefinitionException {
    	bootstrap();
    	
    	Node node;
		try {
			node = parse("Miniup", langDef);
		} catch (ParseException e) {
			throw new GrammarDefinitionException("Failed to parse language definition: " + e.getMessage(), e);
		}
    	Grammar l = GrammarBuilder.languageFromAST(node);
    	l.register();
    	return l.getName();
    }

    /**
     * Finds a grammar definition given a grammar name.
     * @param name
     * @return
     */
    public static Grammar getLanguage(String name) {
    	return Grammar.get(name);
    }
    
    /**
     * The real thing, transforms input to an Abstract Syntax Tree ( @see Node ) using a specific grammar.
     * Pre-condition: the grammar should already have been loaded.
     * @param languageName
     * @param input
     * @return
     * @throws ParseException
     */
    public static Node parse(String languageName, String input) throws ParseException {
    	return parse(languageName, input, null);
    }
    
    /**
     * @see Miniup.parse, but uses a specified start symbol instead of the default configured start symbol of the grammar. 
     * @param languageName
     * @param input
     * @param startSymbol
     * @return
     * @throws ParseException
     */
    public static Node parse(String languageName, String input, String startSymbol) throws ParseException {
    	return Grammar.get(languageName).parse(input, startSymbol).toAST();
    };
}
package nl.mweststrate.miniup;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;

import nl.mweststrate.miniup.matcher.TokenMatcher;
import nl.mweststrate.miniup.util.Util;


/**
 * This class represents a node in the AbstractSyntaxTree which will be build when Miniup succeeds to parse input.
 * 
 * Child nodes can be found by iterating on this object or by using requesting child nodes by name. Named child knows are only 
 * available for nodes parsed by a sequence matcher. 
 * @author michel
 *
 */
public class Node implements Iterable<Node>{

    private List<Node> children = new ArrayList<Node>();
    boolean terminal = false;
    private Token token;
    private String name;
    private boolean isempty = false;
	private Map<String, Node> childMap;
	private String source;

	/**
	 * Constructs a new Node, name refers to the parse rule that resulted in this node. 
	 * This constructor is used to create Node for non-terminals
	 * This node is not a leaf.
	 * @param name
	 * @param children
	 */
    public Node(String name, List<Node> children) {
        this.name = name;
        this.children = children;
    }
    
    /**
     * Creates a Node that just wraps another child node
     * @param name
     * @param child
     */
    public Node(String name, Node child) {
    	this.name = name;
    	this.children = new ArrayList<Node>();
    	this.children.add(child);
    }
    
    /**
     * Constructs a new terminal Node. ASTNodes created for terminals are always leafs.
     * @param terminalType, name of the TokenMatcher
     * @param text
     */
    public Node(String terminalType, Token token) {
        terminal = true;
        this.token = token;
        this.name = terminalType;
    }
    
    /**
     * Creates a Node for a lambda 'nothing found' match. 
     * @param name
     */
    public Node(String name) {
        this.name = name;
        this.isempty = true;
    }

    /**
     * Creates an Node as produced by sequences, some children might have an accessor name. 
     * @param name
     * @param children
     * @param childMap
     */
    public Node(String name, List<Node> children, Map<String, Node> childMap) {
		this.name = name;
		this.children = children;
		this.childMap = childMap;
	}

    /**
     * Returns true if this Node was constructed by the provided syntax rule name
     * @param rulename
     * @return
     */
	public boolean is(String rulename) {
        return name.equals(rulename);
    }
    
	/**
	 * Returns true if this Node has a child which was matched by the provided sequenceName.
	 * @param sequenceName
	 * @return
	 */
    public boolean has(String sequenceName) {
    	if (this.childMap == null)
    		return false;
        return this.childMap.containsKey(sequenceName);
    }
    
    /**
     * Returns true if this node was constructed by a lambda match, that is, nothing was matched and this node has no actual content
     * @return
     */
    public boolean isLambda() {
		return isempty;
	}

    /**
     * Returns true if this node matched a terminal, in other words, concrete input. 
     * @see text()
     * @return
     */
	public boolean isTerminal() {
        return terminal;
    }
    
	/**
	 * returns the token that was used to match this terminal
	 * @return
	 */
	public Token getToken() {
		if (!isTerminal())
			throw new IllegalArgumentException("Node.text() can only be invoked on terminal nodes");
		return token;
	}

	/**
	 * Returns the text matched by this terminal. 
	 * Precondition: isTerminal() returns true. 
	 * @return
	 */
    public String text() {
    	if (!isTerminal())
    		throw new IllegalArgumentException("Node.text() can only be invoked on terminal nodes");
        return token.getText();
    }
    
    /**
     * Returns the name of the syntaxrule that constructed this Node. 
     * (Not to be confused with sequence name. Sequence names are only known by the parent node) 
     * @return
     */
    public String name() {
        return name;
    }

    /**
     * Iterates all children of this node
     */
    @Override
    public Iterator<Node> iterator() {
       // if (isTerminal())
       //     throw new IllegalStateException("Node.iterator(): Terminals do not have children");
        return children.iterator();
    }
    
    /**
     * Given a walker, walks in recursively in depth first order through this item and all its children, invoking @see walker.hit for each Node encountered.
     * @param walker
     */
    public boolean walk(INodeWalker walker) {
    	if (!walker.hit(this))
    		return false;
    	
    	for(Node c : this)
    		if (!c.walk(walker))
    			return false;
    	
    	return true;
    }

    /**
     * Returns the child matched for the given index. Index is zero based
     * @param index
     * @return
     */
    public Node get(int index) {
    	if (index >= size())
    		return null;
        return children.get(index);
    }
    
    /**
     * Same as @see get (0);
     * @return
     */
    public Node first() {
    	if (size() == 0)
    		return null;
    	return get(0);
    }
    
    /**
     * Returns the child with the given accessor name. Only applicable for ATNodes constructed by a sequence.
     * @param name
     * @return
     */
    public Node get(String name) {
        if (!this.has(name))
        	throw new IllegalArgumentException("Unknown child: '" + name + "'");
    	return childMap.get(name);
    }


    /**
     * returns all keys availble in this Node. Only applicable if this node was created by a sequence.
     * @return
     */
    public Set<String> getKeys() {
    	if (this.childMap == null)
    		return new HashSet<String>();
    	return childMap.keySet();
    }   
    
    public Node terminal() {
    	if (isTerminal())
    		return this;
    	if (isLambda())
    		return null;
    	return first().terminal();
    }

    public Node find(final String name) {
        final List<Node> s = new ArrayList<Node>();
        this.walk(new INodeWalker() {
			
			@Override
			public boolean hit(Node node) {
				if (node.has(name)) {
					s.add(node.get(name));
					return false;
				}
				return true;
			}
		});
        
        if (s.size() > 0 && s.get(0) != null)
        	return s.get(0);
        return null;
    }
    
    
    /**
     * Tries to generate a java (primitive) object from the text of this token
     * @return
     */
    public Object value() {
    	return value(null);
    }
    
    public Object value(Object defaultValue) {
    	Object v = TokenMatcher.textToValue(text());
    	if (v == null)
    		return defaultValue;
    	return v;
    }

    public String findText() {
    	Node n = terminal();
    	if (n != null)
    		return n.text();
    	return null;
    }
    
    public String findText(int i) {
		//special case, if i == 0 allow to return ourselves
		if (i == 0 && isTerminal())
			return text();

    	Node n = get(i);
    	if (n != null)
    		return n.terminal().text();
    	return null;
    }
    
    public String findText(String name) {
    	Node n = find(name);
    	if (n != null && !n.isLambda())
    		return n.terminal().text();
    	return null;
    }
    
    /**
     * Returns the number of children matched for this node.
     * @return
     */
    public int size() {
        return children.size();
    }


    /**
     * Constructs a recursive string representation of this Node
     */
    public String toString() {
        if (isTerminal())
            return "'" + text() + "'";
        if (isempty)
            return "-";
        String res = "(" + name;
        for(Node child : this) {
            res += " " + child.toString();
        }
        return res + ")";
    }
    
    /**
     * Pretty print version of the toString() method, returns the AST but formatted in a multiline string with indenting
     * @return
     */
    public String toMultilineString() {
    	StringBuffer buf = new StringBuffer();
    	toMultilineString(buf, 0);
    	return buf.toString();
    }

	private void toMultilineString(StringBuffer buf, int in) {
		if (isTerminal())
			buf.append(Util.leftPad("'" + text() + "'", in));
		else if (isempty) 
			buf.append(Util.leftPad("-", in));
		else {
			buf.append(Util.leftPad("(" + name, in));
			
			boolean allChildsTerminal = true;

			for(Node child : this)
				if (!child.isTerminal() && !child.isLambda()) {
					allChildsTerminal = false;
					break;
				}
		
			for(Node child : this) {
				if (allChildsTerminal)
					child.toMultilineString(buf, 2);
				else {
					buf.append("\n");
					child.toMultilineString(buf, in + 2);
				}
			}
			
			if (allChildsTerminal)
				buf.append(")");
			else 
				buf.append("\n").append(Util.leftPad(")", in));
		}
	}

	public void setSource(String source) {
		this.source = source;		
	}
	
	public String getSource() {
		return this.source;
	}

	public List<String> allTexts() {
		final List<String> res = new ArrayList<String>();
		this.walk(new INodeWalker() {
			
			@Override
			public boolean hit(Node node) {
				if (node.isTerminal())
					res.add(node.text());
				return true;
			}
		});
		return res;
	}
}
package nl.mweststrate.miniup;

import nl.mweststrate.miniup.matcher.TokenMatcher;


public class Token {

	int line = 0;
    int col = 0;
    private TokenMatcher matcher;
    private String text;
    
    /**
     * Constructor used by the parser to create new tokens
     * @param tokenMatcher
     * @param text
     */
    public Token(TokenMatcher tokenMatcher, String text) {
        this.matcher = tokenMatcher;
        this.text = text;
    }

    /**
     * Used by the parser to set the coords of this token in the original input file
     * @param line
     * @param col
     */
    public void setCoords(int line, int col) {
        this.line = line;
        this.col = col;
    }
    
    /**
     * Returns the text matched by this token
     * @return
     */
    public String getText() { return this.text; }
    
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
    public boolean isWhiteSpace() { return matcher.isWhiteSpace(); }
    
    public String toString() {
        return String.format("<%s @ %d:%d = %s>", matcher.getName(), line, col, text.replaceAll("\n", "\\\\n").replaceAll("\r",""));
    }

}
package nl.mweststrate.miniup.core;

import java.util.ArrayList;
import java.util.List;

import nl.mweststrate.miniup.Node;
import nl.mweststrate.miniup.matcher.AbstractMatcher;
import nl.mweststrate.miniup.matcher.ChoiceMatcher;
import nl.mweststrate.miniup.matcher.ImportMatcher;
import nl.mweststrate.miniup.matcher.ListMatcher;
import nl.mweststrate.miniup.matcher.OperatorMatcher;
import nl.mweststrate.miniup.matcher.SequenceMatcher;
import nl.mweststrate.miniup.matcher.SetMatcher;
import nl.mweststrate.miniup.matcher.TokenMatcher;
import nl.mweststrate.miniup.matcher.SequenceMatcher.SequenceItem;
import nl.mweststrate.miniup.matcher.TokenMatcher.BuiltinToken;

public class GrammarBuilder {

    public static Grammar languageFromAST(Node langNode) throws GrammarDefinitionException {
        try {
	    	Node t = langNode;//.get(0);
	    	Grammar b = new Grammar(t.get(0).text());
	        for(Node option : t.get(1)) {
	        	String name = option.terminal().text();
	        	String value = option.isTerminal() ? "true" : option.findText(1);
	        	
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
	                throw new IllegalArgumentException("Error while creating language: Option '" + option.findText(0)+ "' is unknown.");
	        }
	        for(Node def : t.get(2)) {
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
	            
	            for(Node option : def.get(1)) {
	            	if (option.isTerminal())
	            		m.setOption(option.text(), true);
	            	else
	            		m.setOption(option.findText(0), option.get(1).terminal().value());
	            }
	       }
	        return b;
        }
        catch(Exception e) {
        	throw new GrammarDefinitionException("Failed to construct language: " + e.getMessage(), e);
        }
    }

    private static AbstractMatcher parseChoiceDef(Grammar b, String name, Node choices) throws ParseException, GrammarDefinitionException {
    	List<String> items = new ArrayList<String>();
    	for (Node child : choices)
    		items.add(toTerminalName(b, child));
    	
		ChoiceMatcher rule = new ChoiceMatcher(b, name, items.toArray(new String[items.size()]));
		b.addRule(rule);
		return rule;
	}

    private static AbstractMatcher parseImportDef(Grammar b, String name, String languagename, String rulename) throws ParseException, GrammarDefinitionException {
		ImportMatcher rule = new ImportMatcher(b, name, languagename, rulename);
		b.addRule(rule);
		return rule;
	}    
    
	private static AbstractMatcher parseOpDef(Grammar b, Node def) throws ParseException, GrammarDefinitionException {
    	OperatorMatcher rule = new OperatorMatcher(b, def.findText(0), true, 
    			toTerminalName(b, def.get(2)), 
    			toTerminalName(b, def.get(3)));
    	b.addRule(rule);
    	return rule;
	}

	private static AbstractMatcher parseSetDef(Grammar b, Node def) throws ParseException, GrammarDefinitionException {
    	String seperatorOrNull = null;
		String preOrNull = null;
		String postOrNull = null;
		
		if (!def.get(3).isLambda()) { //matched 'using'?
			Node items = def.get(4);
			switch(items.size()) {
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
		
		List<String> items = new ArrayList<String>();
		for(Node choice : def.get(2)) {
			items.add(toTerminalName(b, choice));
		}
		
		SetMatcher rule = new SetMatcher(b, def.findText(0), seperatorOrNull, preOrNull, postOrNull, items.toArray(new String[items.size()]));
		b.addRule(rule);
		return rule;
	}

	private static AbstractMatcher parseListDef(Grammar b, Node def) throws ParseException, GrammarDefinitionException {
        Node items = def.get(2);

        return constructList(b, def.findText(0), items);
    }

    private static AbstractMatcher parsesequenceDef(Grammar b, String name, Node items) throws ParseException, GrammarDefinitionException {
        SequenceMatcher rule = new SequenceMatcher(b, name);
        b.addRule(rule);
        for (Node item : items) {
            //0 = value, 1 = '?' -> required, 2 = options
            rule.addItem(new SequenceItem(toTerminalName(b, item.get(1)), item.get(2).isLambda(), item.get(0).isLambda() ? null : item.findText(0)));
        }
        return rule;
    }
    
    //given a token 'xyz' or xyz, returns the token, or the generated name for the terminal
    //TODO:has to change, tokens and ids are parsed in another way
    private static String toTerminalName(Grammar b, Node astNode) throws GrammarDefinitionException, ParseException {
    	if (astNode.isTerminal()) {
	    	String text = astNode.text();
	    	if (text.startsWith("'") || text.startsWith("\"")) 
	            return b.keyword((String) astNode.value());
	        return text;
    	}
    	else {
    		String name = "subrule_" + (b.subruleCount++);
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
    
    private static ListMatcher constructList(Grammar b, String name, Node items) throws ParseException, GrammarDefinitionException {
        //1 item = value, 2 items = value, seperator, 4 items = 
        String token = null;
        String separator = null;
        String pre = null;
        String post = null;
        
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

	private static boolean hasOption(Node def, String option) {
        for(Node opt : def.get(1)) {
        	if (opt.isTerminal() && opt.text().equals(option)) //simple 
    			return true;
            else if (!opt.isTerminal() && opt.findText(0).equals(option))
                return (Boolean) opt.get(1).terminal().value(Boolean.TRUE);
        }
        return false;
    }

    private static AbstractMatcher parseTokenDef(Grammar b, Node def) throws ParseException, GrammarDefinitionException {
    	String regexp = (def.get(2).text());
    	regexp = regexp.substring(1, regexp.length()-1).replaceAll("\\\\([\\/])", "$1");
        return b.addTokenmatcher(def.findText(0), regexp, hasOption(def, "whitespace"));
    }

    public static Grammar createBootstrapper() throws ParseException, GrammarDefinitionException {
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
        b.addChoice("definition", "tokenDef","choiceDef", "sequenceDef", "listDef", "setDef", "opDef", "importDef");
        
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
        choice value 			: String | ID;
        choice String 			: StringSingle; // StringDouble ; 
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
        //b.addChoice("String", items)
        b.setStartSymbol("langdef");
        return b;
        
    }

	private static void addDefaultTokens(Grammar b)
			throws GrammarDefinitionException {
		for(BuiltinToken tm : TokenMatcher.BuiltinToken.values())
        	tm.registerTokenMatcher(b);
	}

}
package nl.mweststrate.miniup.core;

public class GrammarDefinitionException extends Exception {
	/**
	 * 
	 */
	private static final long serialVersionUID = -474472271515546559L;

	public GrammarDefinitionException(String message) {
		super(message);
	}

	public GrammarDefinitionException(String message, Exception cause) {
		super(message,cause);
	}


}
package nl.mweststrate.miniup.core;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Vector;
import java.util.regex.Pattern;

import nl.mweststrate.miniup.matcher.AbstractMatcher;
import nl.mweststrate.miniup.matcher.ChoiceMatcher;
import nl.mweststrate.miniup.matcher.ListMatcher;
import nl.mweststrate.miniup.matcher.OperatorMatcher;
import nl.mweststrate.miniup.matcher.SequenceMatcher;
import nl.mweststrate.miniup.matcher.SetMatcher;
import nl.mweststrate.miniup.matcher.TokenMatcher;
import nl.mweststrate.miniup.matcher.SequenceMatcher.SequenceItem;


public class Grammar {
    static public Map<String, Grammar> languages = new HashMap<String, Grammar>();
    
    private Map<String, TokenMatcher> tokenMatchers = new HashMap<String, TokenMatcher>();
    private Vector<TokenMatcher> wstokenMatchers = new Vector<TokenMatcher>();
    
    private Map<String, AbstractMatcher> rules = new HashMap<String, AbstractMatcher>(); 
    private String name;

    private boolean caseInSensitive;

    private String startSymbol;

	private int maxBacktrackingDepth = -1;
	public int subruleCount = 1;

	private boolean disableautowhitespace;
    
    public static Grammar get(String name) {
        if (!languages.containsKey(name))
            throw new IllegalArgumentException("Unknown language: '" + name + "'");
        return languages.get(name);
    }
    
    public Grammar(String name) {
        this.name = name; 
        languages.put(name, this);
    }
    
    public Match parse(String input) throws ParseException {
    	return parse(input, null);
    }
    
    public Match parse(String input, String startSymbol) throws ParseException {
        return new Parser(this, input).parse(startSymbol); 
    }
    
    public String getStartSymbol() {
        return this.startSymbol;
    }

    public AbstractMatcher getMatcher(String token) throws IllegalArgumentException {
        if (!this.rules.containsKey(token))
            throw new IllegalArgumentException("Undefined rule / token: '"  + token + "'");
        return this.rules.get(token);
    }

    public boolean getCaseInSensitive() {
        return this.caseInSensitive;
    }

    public String getName() {
        return name;
    }
    
    public void setStartSymbol(String startSymbol) {
        this.startSymbol = startSymbol;		
    }    
    
    public void setCaseInsensitive(boolean b) {
        this.caseInSensitive = b;
    }
    
    public void setDisableAutoWhitespace(boolean b) {
    	this.disableautowhitespace = b;
    }

    public String addRule(AbstractMatcher rule) throws IllegalArgumentException {
        if (this.rules.containsKey(rule.getName()))
            throw new IllegalArgumentException("A rule for '"+ rule.getName() + "' has already been registered");
        this.rules.put(rule.getName(), rule);
        return rule.getName();
    }

    public AbstractMatcher addTokenmatcher(String name, String regexp, boolean whiteSpace) throws GrammarDefinitionException  {
    	try {
    		TokenMatcher tm = new TokenMatcher(this, name, regexp, whiteSpace);
    		tokenMatchers.put(regexp, tm);
    		if (whiteSpace)
    			wstokenMatchers.add(tm);
    		
    		addRule(tm);
    		return tm;
    	}
    	catch(java.util.regex.PatternSyntaxException e) {
    		throw new GrammarDefinitionException("Invalid token definition, regular expression is invalid: " + e.getMessage(), e);
    	}
    }    
    
    public String keyword(String token) throws GrammarDefinitionException {
    	
        String regexp = Pattern.quote(token);
        if (Pattern.matches("^[a-zA-Z_]+$", token)) //add a word boundary if the token is a word
            regexp += "\\b";
        
        TokenMatcher existing = this.tokenMatchers.get(regexp);
        if (existing != null) {
        	if (existing.isWhiteSpace() || !existing.isKeyword())
        		throw new GrammarDefinitionException("Failed to register keyword '" + token + "': the same token is already defined as a non-keyword or whitespace token");
            return existing.getName();
        }
        
        String tokenname = /*  "_t" + (tokenMatchers.size() + 1) */ "'" + token + "'";

        TokenMatcher tm = (TokenMatcher) this.addTokenmatcher(tokenname, regexp, false);
        tm.setIsKeyword(token);
        return tokenname;
    }

    public String addList(String name, boolean nullable, String item, String nullOrSeperator, String nullOrPre, String nullOrPost, boolean allowTrailing) throws ParseException {
        ListMatcher newrule = new ListMatcher(this, name, item, nullOrSeperator, nullOrPre, nullOrPost);
        newrule.setOption(ListMatcher.NULLABLE_OPTION, (Boolean) nullable);
        newrule.setOption(ListMatcher.ALLOWTRAILING_OPTION, (Boolean) allowTrailing);
    	return addRule(newrule);
    }

    public SequenceMatcher addSequence(String name, SequenceItem... items) throws ParseException {
        SequenceMatcher r =  new SequenceMatcher(this, name);
        for (SequenceItem item: items)
            r.addItem(item);
        addRule(r);
        return r;
    }

    public String addChoice(String name, String... items) throws ParseException {
        return addRule(new ChoiceMatcher(this, name, items));
    }

    public String addOperator(String name, boolean left, String operator, String operand) throws ParseException {
       return addRule(new OperatorMatcher(this, name, left, operator, operand));
    }

    public String addSet(String name, String seperatorOrNull, String preOrNull, String postOrNull, String... items) throws ParseException {
        return addRule(new SetMatcher(this, name, seperatorOrNull, preOrNull, postOrNull, items));
     }

	public void setBacktracking(int maxdepth) {
		this.maxBacktrackingDepth = maxdepth;
		
	}

	public int getMaxRecursionDepth() {
		return this.maxBacktrackingDepth;
	}

	public List<TokenMatcher> getWhiteSpaceTokens() {
		return this.wstokenMatchers;
	}

	public int ruleCount() {
		return this.rules.size();
	}

	public void register() {
		Grammar.languages.put(this.getName(), this);
	}

	public boolean getDisableAutoWhitespace() {
		return this.disableautowhitespace;
	}

	public boolean parsePartial(Parser parentParser, Match parent, String rulename) throws ParseException {
		return new Parser(this, parentParser.getInputString()).parsePartial(parentParser, parent, rulename);
	}
}
package nl.mweststrate.miniup.core;

import java.util.ArrayList;
import java.util.List;

import nl.mweststrate.miniup.Node;
import nl.mweststrate.miniup.Token;
import nl.mweststrate.miniup.matcher.AbstractMatcher;
import nl.mweststrate.miniup.matcher.TokenMatcher;


public class Match {
    private List<Match> children = new ArrayList<Match>();
    private List<Match> nonWSchildren = new ArrayList<Match>();
    
    private Match parent;
    private int start;
    private int end;
    private AbstractMatcher matchedBy;
    private boolean isRoot;
    private int max;
    private Token terminal = null;
    private String nilMatch = null;
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

    public void register(Match match) {
        children.add(match);
        //if its a match from the cache, we can consume all its tokens directly
        eat(match.charsConsumed());
        
        if (!match.isWhitespace())
        	nonWSchildren.add(match);
    }

    public void eat(int amount) {
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
    public void unMatch() {
    	Match m = children.get(children.size() -1);
        this.unEat(m.charsConsumed());
        
        children.remove(children.size() -1);
        if (!m.isWhitespace())
        	nonWSchildren.remove(nonWSchildren.size() -1);
    }
    
    public boolean isWhitespace() {
		return getMatchedBy() instanceof TokenMatcher && ((TokenMatcher) getMatchedBy()).isWhiteSpace();
	}

	private void unEat(int items) {
        end -= items;
        if (parent != null)
            parent.unEat(items);
    }
    
    public String toString() {
        if (isRoot)
            return String.format("[%d : %d = [ROOT]]", start, end);
        return String.format("[%d : %d = %s []]", start, end, matchedBy.getName());
    }
    
    public String toMatchString() {
       if (this.isRoot) 
    	   return this.subMatchCount(true) > 0 ? this.getSubMatch(0, true).toMatchString() : "";
       
        if (this.nilMatch != null) 
            return "-";
        String res = "(" + this.matchedBy.getName() + ":";
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
        for(Match m : this.nonWSchildren) {
            res+= " " + m.toMatchString();
        }
        return res + ")";
    }

    public Match lastChild() {
        return this.children.get(this.children.size() -1);
    }

    public int getFirstCharPos() {
        return start;		
    }

    public void setTerminal(Token terminal) {
        this.terminal = terminal;		
    }

    public void setNil(String token) {
        this.nilMatch = token;
    }

	public Match getLastMatch(boolean excludeWS) {
		if (this.subMatchCount(excludeWS) == 0)
			throw new IllegalArgumentException("Empty matches do not have a last match");
		return this.getSubMatch(0, excludeWS);
	}

	public Match getSubMatch(int i, boolean excludeWS) {
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

	public List<Match> getSubMatches() {
		return this.nonWSchildren;
	}
}package nl.mweststrate.miniup.core;

import java.util.HashMap;
import java.util.Map;

import nl.mweststrate.miniup.Miniup;
import nl.mweststrate.miniup.matcher.AbstractMatcher;
import nl.mweststrate.miniup.matcher.TokenMatcher;

public class MatchMemoizer {
	int cachehits = 0;
	int cachemisses = 0;
	
	Map<Integer, Map<String, Match>> matchCache = new HashMap<Integer, Map<String, Match>>();
	
    boolean isInCache(int curpos, AbstractMatcher matcher) {
    	if (!Miniup.USE_TOKEN_MEMOIZATION)
    		return false;
    	
    	boolean res = matcher instanceof TokenMatcher;
    	
    	if (res) {
    		if (!matchCache.containsKey(curpos)) {
    			matchCache.put(curpos, new HashMap<String,Match>());
    			res = false; //appearantly, it is not in cache :)
    		}
    		else
    			res = matchCache.get(curpos).containsKey(matcher.getName());
    	}
    	
    	if (res)
    		cachehits +=1;
    	else
    		cachemisses += 1;
    	return res;    	
    }
    
	boolean consumeFromCache(Match parent, String token, int curpos) {
		Match catched = matchCache.get(curpos).get(token);
		if (catched != null) {
			parent.register(catched);
			return true;
		}
		return false;
	}

	void storeInCache(Match parent, int curpos,	AbstractMatcher matcher) {
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
package nl.mweststrate.miniup.core;

import java.util.Stack;

import nl.mweststrate.miniup.Miniup;
import nl.mweststrate.miniup.util.Pair;
import nl.mweststrate.miniup.util.Util;

public class ParseException extends Exception {

    /**
	 * 
	 */
	private static final long serialVersionUID = -826584894413162138L;
	private StringBuilder msg;
	private Stack<Pair<String, Integer>> stack;

	/**
	 * 
	 * @param p
	 * @param usebestMatchStack, true: display the stack that gave us the best result, false: display the current stack
	 * @param string
	 */
	@SuppressWarnings("unchecked")
	public ParseException(Parser p, boolean usebestMatchStack, String string) {
		super();
        this.msg = new StringBuilder();
        msg.append("Parse exception: " + string);
        
        if (p.bestPoint > -1) 
        	msg.append(Util.hightlightLine(p.getInputString(), p.getCurrentLineNr(p.bestPoint), p.getCurrentColNr(p.bestPoint)));
        
        if (usebestMatchStack && p.expected.size() > 0)
        	msg.append("\nExpected: " + Util.join(p.expected, " or ") + "\n");
        
        this.stack = (Stack<Pair<String, Integer>>) (usebestMatchStack ? p.bestStack.clone() : p.stack.clone());

        if (Miniup.VERBOSE) {
        	msg.append("\nParse stack: \n");

        	for(Pair<String, Integer> item : this.stack) 
        		msg.append("\t"+item.getFirst()+ (item.getSecond() > 0 ? " no. " + (item.getSecond()+1) : "") + "\n");
        }
    }
	
	public String getMessage() {
		return msg.toString();
	}
	
	public Stack<Pair<String, Integer>> getParseStack() {
		return this.stack;
	}

}
package nl.mweststrate.miniup.core;

import java.util.Date;
import java.util.HashSet;
import java.util.Set;
import java.util.Stack;

import nl.mweststrate.miniup.Miniup;
import nl.mweststrate.miniup.matcher.AbstractMatcher;
import nl.mweststrate.miniup.matcher.TokenMatcher;
import nl.mweststrate.miniup.util.Pair;
import nl.mweststrate.miniup.util.Util;

public class Parser {
    Grammar language;
    private String inputstring = null;;
    
    Stack<Pair<String, Integer>> stack = new Stack<Pair<String, Integer>>();
    Stack<Pair<String, Integer>> bestStack = new Stack<Pair<String, Integer>>();
    Set<String> expected = new HashSet<String>();

    int bestPoint = -1;

	MatchMemoizer memoizer;
	
	//Fields used for statistics
	private long start;
	
	private int calls = 0;
	private int found = 0;
	private int notfound = 0;

    
    public Parser(Grammar language, String input) {
        this.language = language;
        this.inputstring = input;
        memoizer = new MatchMemoizer();
    }
    
    public Match parse() throws ParseException {
    	return parse(null);
    }
    
    public boolean parsePartial(Parser parentParser, Match parentMatch, String startSymbol) throws ParseException {
    	this.stack = parentParser.stack;
    	this.bestPoint = parentParser.bestPoint;
    	consumeWhitespace(parentMatch);
    	boolean res = consume(parentMatch, startSymbol);
    	
    	if (bestPoint > parentParser.bestPoint) {
    		parentParser.expected  = expected;
    		parentParser.bestPoint = bestPoint;
    		parentParser.bestStack = bestStack;
    	}
    	
    	return res;
    }
    
    public Match parse(String startSymbol) throws ParseException {
    	this.start = new Date().getTime();
    	
        Match m = new Match(this);
        consumeWhitespace(m); //consume prepending whitespace

        String s = startSymbol;
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
        	System.out.println(String.format("Finished parsing in %d ms. Stats: %d/%d/%d/%d/%d (read attempts/successfull reads/failed reads/cache hits/cache misses)",
        			(new Date().getTime()) - start, calls, found, notfound, memoizer.cachehits, memoizer.cachemisses));
        return m;
    }
    
    public boolean consume(Match parent, String token) throws ParseException {
    	stack.push(Pair.pair(token, 0));
    	int curpos = parent.getLastCharPos();
    	boolean result = false;

    	if (Miniup.VERBOSE)
    		System.out.println(String.format("[%s:%s]%s", getCurrentLineNr(curpos), getCurrentColNr(curpos), Util.leftPad(token + " ?", stack.size())));
    	this.calls += 1;
    	
        try {
        	if (language.getMaxRecursionDepth() != -1 && stack.size() > language.getMaxRecursionDepth())
        		throw new ParseException(this, false, "Maximum stack depth reached. ");
        	
        	AbstractMatcher matcher = language.getMatcher(token);
        	this.storeExpected(matcher, parent, curpos);

        	if (memoizer.isInCache(curpos, matcher))  {
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
	    		System.out.println(String.format("[%s:%s]%s", getCurrentLineNr(curpos), getCurrentColNr(curpos), Util.leftPad(token + " V", stack.size())));
	        if (result) {
	        	this.found += 1;
/*	        	if (Miniup.VERBOSE) 
		        	System.out.println(Util.leftPad("...and now for something completely different: " + 
		        			Util.trimLength(this.getInputString().substring(parent.getLastCharPos()),20), 
		        			stack.size() -1));
*/	        }
	        else
	        	this.notfound +=1;
        
	        return result;
        }
        finally {
        	stack.pop();
        }
    }

	private void consumeWhitespace(Match parent) throws ParseException {
		if (language.getDisableAutoWhitespace())
			return;
		
		boolean res = true;
		int curpos = parent.getLastCharPos();
		
		while(res) {
			res = false;
			for(TokenMatcher wsMatcher : language.getWhiteSpaceTokens()) {
				if (memoizer.isInCache(curpos, wsMatcher))
					res = memoizer.consumeFromCache(parent, wsMatcher.getName(), curpos);
				else
					res = wsMatcher.match(this, parent);
				if (res)
					break;
			}
		}
	}

    public void consumeLambda(Match parent, String token) {
        Match match = new Match(this, parent, null);
        match.setNil(token);
        
        if (Miniup.VERBOSE)
        	System.out.println(Util.leftPad("-", stack.size()));
    }

    public String getInputString() {
        return this.inputstring;
    }
    
	@SuppressWarnings("unchecked")
	private void storeExpected(AbstractMatcher matcher, Match parent, int curpos) {
		if (curpos > bestPoint) {
			bestPoint = curpos;
			bestStack = (Stack<Pair<String, Integer>>) stack.clone();
			expected.clear();
		}
		if (matcher instanceof TokenMatcher && curpos >= bestPoint) {
			expected.add(matcher.getName());
		}
	}
    
	public void setStackIter(int index) {
		stack.push(Pair.pair(stack.pop().getFirst(), index));
	}

	public int getCurrentLineNr(int curpos) {
		if (curpos == -1)
			return -1;
		
		String input = getInputString().substring(0, curpos);
    	int line = 1 + Util.countMatches(input, "\n");
    	return line;
	}

	public int getCurrentColNr(int curpos) {
		if (curpos == -1)
			return -1;
		
		String input = getInputString().substring(0, curpos);
		int last = input.lastIndexOf('\n');
    	int col = input.length() - last;
    	return col;
	}
	
	public String getCurrentInputLine(int curpos) {
		String input = getInputString();
		return Util.getInputLineByPos(input, curpos);
	}


}
package nl.mweststrate.miniup.core;

import java.io.IOException;

import nl.mweststrate.miniup.Node;
import nl.mweststrate.miniup.matcher.SequenceMatcher;
import nl.mweststrate.miniup.matcher.SequenceMatcher.SequenceItem;
import nl.mweststrate.miniup.util.Util;

public class TestSuite {

	public static void runTestsuite() throws Exception, ParseException, IOException {
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
	    String data;
	    data = Util.readFileAsString("res/miniup.txt");
	    
	    //test bootstrap
	    Match m = b.parse(data);
	    
	    Node t = m.toAST();
	    System.out.println(t);
	    Grammar b2 = GrammarBuilder.languageFromAST(t);
	    
	    //try to parse ourselves a few times... that makes a nice unit test
	    for(int i = 0; i < 3; i++) {
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
    private static void test1() throws Exception {
        String data = Util.readFileAsString("res/test1.txt");
        
        Grammar bootstrap = new Grammar("test1");
        bootstrap.addTokenmatcher("identifier","\\w+", false);
        bootstrap.addTokenmatcher("whitespace","\\s+", true);
        bootstrap.addTokenmatcher("number","\\d+", true);
        bootstrap.keyword("bla");
        bootstrap.keyword("bla");
        bootstrap.keyword(">=");
        bootstrap.keyword("==");
        bootstrap.keyword(">");
        bootstrap.keyword("=");
    }

    private static void test2() throws Exception {
        
        Grammar x = new Grammar("test2");
        String ID = "identifier";
        x.addTokenmatcher("identifier","\\w+", false);
        x.addTokenmatcher("whitespace","\\s+", true);
        x.addTokenmatcher("number","\\d+", true);

        SequenceMatcher hw = x.addSequence("hw", new SequenceItem(ID), new SequenceItem(ID, false));

        x.setStartSymbol(hw.getName());
        Match m = x.parse("hello");
        test(m.toMatchString(), "(hw: 'hello' -)");
     
        Match m2 = x.parse("hello world");
        test(m2.toMatchString(), "(hw: 'hello' 'world')");
      
        String o = x.keyword("other");
        String p = x.keyword("planet");
        x.setStartSymbol(x.addChoice("op", o, p));
        test(x.parse("  planet  \n").toMatchString(),"(op: planet)");
        
        x.setStartSymbol(x.addList("list1", true, ID, null, o, p, true));
        test(x.parse("other planet").toMatchString(),"(list1: other planet)");
        test(x.parse("other blaat blaat planet").toMatchString(),"(list1: other 'blaat' 'blaat' planet)");

        x.setStartSymbol(x.addList("list2", true, ID, x.keyword(","), o, p, true));
       // test(x.parse("other planet").toAST().toString(),"(list2 (list2))");
        test(x.parse("other hoi , hoi planet").toAST().toString(),"(list2 'hoi' 'hoi')");  
        test(x.parse("other hoi , hoi, planet").toAST().toString(),"(list2 'hoi' 'hoi')");
        test(x.parse("other oi,planet").toMatchString(),"(list2: other 'oi' , planet)");
        test(x.parse("other blaat, blaat planet").toMatchString(),"(list2: other 'blaat' , 'blaat' planet)");
        
        x.addList("planets", true, "identifier", null, null, null, false);
        x.addSequence("emptyListEOF", new SequenceItem("identifier"), new SequenceItem("planets")); 
        //MWE: bug found: this should not throw EOF!
        test(x.parse("bladibla", "emptyListEOF").toMatchString(), "(emptyListEOF: 'bladibla' (planets:))");
        
    }
    
    private static void test3() throws Exception {
        //language without backtracking
        Grammar x = new Grammar("test3");
        x.addTokenmatcher("whitespace","\\s+", true);
        String Number = "number";
        x.addTokenmatcher("number","\\d+", false);
        
        String mul = x.addOperator("mul", true, x.keyword("*"), Number);
        String add = x.addOperator("add", false, x.keyword("+"),mul);
        String Expr = x.addChoice("expr", add);
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
    
    private static void test4() throws Exception {
        //language with backtracking
        Grammar x = new Grammar("test4");
        x.setBacktracking(50);
        x.addTokenmatcher("whitespace","\\s+", true);
        String Number = "number";
        x.addTokenmatcher("number","\\d+", false);
        
        String mul = x.addOperator("mul", true, x.keyword("*"), "expr");
        String add = x.addOperator("add", false, x.keyword("+"),"expr");
        x.addSequence("paren", 
        		new SequenceItem(x.keyword("(")), 
        		new SequenceItem("expr"), 
        		new SequenceItem(x.keyword(")")));
        String Expr = x.addChoice("expr", add,mul,Number, "paren");
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
    private static void test(String ast, String string) {
        System.out.println(ast);
        if (!ast.trim().equals(string))
            throw new AssertionError("TEST FAILED: Expected:\n"+string+"\n\nReceived:\n\n"+ast);
    }
}
package nl.mweststrate.miniup.matcher;

import java.util.HashMap;
import java.util.Map;

import nl.mweststrate.miniup.Node;
import nl.mweststrate.miniup.core.Grammar;
import nl.mweststrate.miniup.core.Match;
import nl.mweststrate.miniup.core.ParseException;
import nl.mweststrate.miniup.core.Parser;


public abstract class AbstractMatcher {

    protected String name;
    protected Grammar language;
    private Map<String, Object> options = new HashMap<String, Object>();

    public AbstractMatcher(Grammar language, String name) {
      this.name = name;
      this.language = language;
    }
    
    public boolean match(Parser parser, Match parent) throws ParseException {
        //if (parent.getLastCharPos() >= parser.getInputString().length()) //EOF
        //    return false;
        Match match = new Match(parser, parent, this);
        if (!this.performMatch(parser, match)) {
            parent.unMatch();
            return false;
        }
        
        return true;
    }

    abstract boolean performMatch(Parser parser, Match parent) throws ParseException;

    public String getName() { return name;}
    public Grammar getLanguage() { return language; }
    
    public String toString() { return "Matcher: " +this.getName(); }

    abstract public Node toAST(Match match);

    public void setOption(String key, Object object) {
        this.options.put(key, object);		
    }
    
    public Object getOption(String key, Object defaultvalue) {
    	if (this.options.containsKey(key))
    		return options.get(key);
    	return defaultvalue;
    }
}
package nl.mweststrate.miniup.matcher;

import java.util.ArrayList;
import java.util.List;

import nl.mweststrate.miniup.Node;
import nl.mweststrate.miniup.core.Grammar;
import nl.mweststrate.miniup.core.Match;
import nl.mweststrate.miniup.core.ParseException;
import nl.mweststrate.miniup.core.Parser;


public class ChoiceMatcher extends AbstractMatcher {

    public ChoiceMatcher(Grammar language, String name, String[] items) {
        super(language, name);
        for(String item : items)
            this.choices.add(item);
    }

    List<String> choices = new ArrayList<String>();
    
    @Override
    boolean performMatch(Parser parser, Match parent) throws ParseException {
    	int index = 0;
        for(String choice: choices) {
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
package nl.mweststrate.miniup.matcher;

import nl.mweststrate.miniup.Node;
import nl.mweststrate.miniup.core.Grammar;
import nl.mweststrate.miniup.core.Match;
import nl.mweststrate.miniup.core.ParseException;
import nl.mweststrate.miniup.core.Parser;

public class ImportMatcher extends AbstractMatcher {

	private String languagename;
	private String rulename;

	public ImportMatcher(Grammar language, String name, String languagename, String rulename) {
		super(language, name);
		this.languagename = languagename;
		this.rulename = rulename;
	}

	@Override
	boolean performMatch(Parser parser, Match parent) throws ParseException {
		if (!Grammar.languages.containsKey(languagename))
			throw new ParseException(parser, false, "Grammar import '" + languagename + "' could not be resolved!\n");
		
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
package nl.mweststrate.miniup.matcher;

import java.util.List;
import java.util.Vector;

import nl.mweststrate.miniup.Node;
import nl.mweststrate.miniup.core.Grammar;
import nl.mweststrate.miniup.core.Match;
import nl.mweststrate.miniup.core.ParseException;
import nl.mweststrate.miniup.core.Parser;


public class ListMatcher extends AbstractMatcher {

    public static final String NULLABLE_OPTION = "nullable";
	public static final String ALLOWTRAILING_OPTION = "allowtrailing";
	
	private String token;
    private String pre = null;
    private String post= null;
    private String seperator;

    public ListMatcher(Grammar language, String name, String token, String seperator, String pre, String post) {
        super(language, name);
        this.token = token;
        this.seperator = seperator;
        this.pre = pre;
        this.post = post;
    }

    @Override
    boolean performMatch(Parser parser, Match parent) throws ParseException {
        //match pre token
        if (pre != null) {
            if(!parser.consume(parent, pre))
                return false;
        }
        int index = 0;
        int basepos = -1;
        
        if (post != null && parser.consume(parent,post))
        	return this.isNullable();
        
        if (parser.consume(parent, token)) {
        	while(seperator == null || parser.consume(parent, seperator)) {
        		//detect lambda matching lists...
        		if (parent.getLastCharPos() <= basepos)
        			throw new ParseException(parser, false, "The rule '" + this.name + "', never ends, its items ('" + token + "') can match an empty string");
        		
        		basepos = parent.getLastCharPos();
        		parser.setStackIter(++index);
        		
        		//something has been consumed, assert that it is not empty, otherwise we end up in an endless loop
        		//if (seperator == null && parent.getLastMatch(true).charsConsumed() == 0)
        		//	throw new ParseException(parser, false, "Unterminating match detected. List items should either consume terminals or be seperated.");

        		if (post != null && parser.consume(parent,post))
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
    
    public boolean allowTrailing() {
    	return (Boolean) getOption(ALLOWTRAILING_OPTION, Boolean.FALSE);
	}

	public boolean isNullable() {
		return (Boolean) getOption(NULLABLE_OPTION, Boolean.TRUE);
	}

	@Override
    public Node toAST(Match match) {
        List<Node> children = new Vector<Node>();
        boolean hasPre = pre != null;
        boolean hasSep = seperator != null;
        boolean hasPost = post != null;
        for(int i = 0; i < match.subMatchCount(true); i++){
            if (i == 0 && hasPre)
                continue;
            if (i == match.subMatchCount(true) -1 && hasPost)
                continue;
            if (hasSep && i % 2 == (hasPre ? 0 : 1))
                continue;
            if (!match.getSubMatch(i, true).getMatchedBy().getName().equals(seperator))
        		children.add(match.getSubMatch(i, true).toAST());
        }
        return new Node(this.name, children );
    }
}
package nl.mweststrate.miniup.matcher;

import java.util.List;
import java.util.Vector;

import nl.mweststrate.miniup.Node;
import nl.mweststrate.miniup.core.Grammar;
import nl.mweststrate.miniup.core.Match;
import nl.mweststrate.miniup.core.ParseException;
import nl.mweststrate.miniup.core.Parser;
import nl.mweststrate.miniup.matcher.AbstractMatcher;


public class OperatorMatcher extends AbstractMatcher {
    
    private String operand;
    private String operator;

    public static final String RIGHT_OPTION = "right";
    
    public OperatorMatcher(Grammar language, String name, boolean leftassociative, String operator, String operand) {
        super(language, name);
        this.operand = operand;
        this.operator = operator;
        if (!leftassociative)
        	setOption(RIGHT_OPTION, Boolean.TRUE);
    }

    @Override
    boolean performMatch(Parser parser, Match parent) throws ParseException {
    	//left : a = b (op b)*
    	// if (this.getIsLeftAssociative()) {
        	if (isRepeatingState(parent)) //force backtrack for operators we already tried.
        		return false;
        	
        	if(!parser.consume(parent, operand))
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
     * @throws ParseException
     */
    private boolean isRepeatingState(Match parent) throws ParseException {
    	Match p = parent.getParentMatch();
		while (p != null && p.getMatchedBy() != null) {
			AbstractMatcher matcher = p.getMatchedBy();
			
			//something has been consumed?
			if (   !(matcher instanceof OperatorMatcher)
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
    
	public boolean getIsLeftAssociative() {
		return !((Boolean)this.getOption(RIGHT_OPTION, Boolean.FALSE));
	}

	@Override
	public Node toAST(Match match) {
		List<Match> matches = match.getSubMatches();
		return toASTNodeHelper(matches);	
	}

	private Node toASTNodeHelper(List<Match> matches) {
		List<Node> children = new Vector<Node>();
		int size = matches.size();
		if(size == 3) {
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
			children.add(toASTNodeHelper(matches.subList(2, size )));
		}
		return new Node(this.name, children);
	}

}
package nl.mweststrate.miniup.matcher;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Vector;

import nl.mweststrate.miniup.Node;
import nl.mweststrate.miniup.core.Grammar;
import nl.mweststrate.miniup.core.Match;
import nl.mweststrate.miniup.core.ParseException;
import nl.mweststrate.miniup.core.Parser;


public class SequenceMatcher extends AbstractMatcher {
	public static class SequenceItem {
		private String item;
		private boolean required;
		private String name;

		public SequenceItem(String item) {
			this.item = item;
			this.required = true;
			this.name = null;
		}
		
		public SequenceItem(String item, boolean required) {
			this.item = item;
			this.required = required;
			this.name = null;
		}
		
		public SequenceItem(String item, boolean required, String name) {
			this.item = item;
			this.required = required;
			this.name = name;
		}
	}
	
    public SequenceMatcher(Grammar language, String name) {
        super(language, name);
    }

    List<SequenceItem> toMatch = new Vector<SequenceItem>();;
    
    @Override
    boolean performMatch(Parser parser, Match parent) throws ParseException {
        for(int i = 0;  i < toMatch.size(); i++) {
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

    public void addItem(SequenceItem item) {
        toMatch.add(item);
    }
    
    @Override
    public Node toAST(Match match) {
        List<Node> children = new Vector<Node>();
        Map<String, Node> childMap = new HashMap<String, Node>();
        
        for(int i = 0; i < match.subMatchCount(true); i++) {
            if (toMatch.get(i).required == false || 
                !(match.getSubMatch(i, true).getMatchedBy() instanceof TokenMatcher) ||
                !((TokenMatcher)match.getSubMatch(i, true).getMatchedBy()).isKeyword()){
            	
            	Node child = match.getSubMatch(i, true).toAST();
            	children.add(child);
            	String name = toMatch.get(i).name;
            	if (name != null && !name.isEmpty())
            		childMap.put(name, child);
            }
        }
        return new Node(this.name, children, childMap );
    }

}package nl.mweststrate.miniup.matcher;

import java.util.Arrays;
import java.util.List;
import java.util.Vector;

import nl.mweststrate.miniup.Node;
import nl.mweststrate.miniup.core.Grammar;
import nl.mweststrate.miniup.core.Match;
import nl.mweststrate.miniup.core.ParseException;
import nl.mweststrate.miniup.core.Parser;


public class SetMatcher extends AbstractMatcher {

    private String seperator;
    private List<String> items;
    private String pre;
    private String post;

    public SetMatcher(Grammar language, String name, String seperatorOrNull, String preOrNull, String postOrNull, String... items) {
        super(language, name);
        this.seperator = seperatorOrNull;
        this.pre = preOrNull;
        this.post = postOrNull;
        this.items = Arrays.asList(items);
    }

    @Override
    boolean performMatch(Parser parser, Match parent)
            throws ParseException {
        if (pre != null && !parser.consume(parent, pre))
            return false;
        
        List<String> available = new Vector<String>(items);
        boolean matched = true;
        boolean sepmatched = false;
        while(!available.isEmpty() && matched) {
            matched = false;
            for(String token : available) {
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
        List<Node> children = new Vector<Node>();
        boolean hasPre = pre != null;
        boolean hasSep = seperator != null;
        boolean hasPost = post != null;
        for(int i = 0; i < match.subMatchCount(true); i++){
            if (i == 0 && hasPre)
                continue;
            if (i == match.subMatchCount(true) -1 && hasPost)
                continue;
            if (hasSep && i % 2 == (hasPre ? 0 : 1))
                continue;
            children.add(match.getSubMatch(i, true).toAST());
        }
        return new Node(this.name, children );
    }
}
package nl.mweststrate.miniup.matcher;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import nl.mweststrate.miniup.Node;
import nl.mweststrate.miniup.Token;
import nl.mweststrate.miniup.core.Grammar;
import nl.mweststrate.miniup.core.GrammarDefinitionException;
import nl.mweststrate.miniup.core.Match;
import nl.mweststrate.miniup.core.Parser;
import nl.mweststrate.miniup.util.Util;


public class TokenMatcher extends AbstractMatcher {
	public static enum BuiltinToken {
		IDENTIFIER("[a-zA-Z_][a-zA-Z_0-9]*",false),
		WHITESPACE("\\s+",true),
		INTEGER("-?\\d+", false),
		FLOAT("-?\\d+(\\.\\d+)?(e\\d+)?", false),
		SINGLEQUOTEDSTRING("'(?>[^\\\\']|(\\\\[btnfr\"'\\\\]))*'",false),
		DOUBLEQUOTEDSTRING("\"(?>[^\\\\\"]|(\\\\[btnfr\"'\\\\]))*\"",false),
		SINGLELINECOMMENT("//[^\\n]*(\\n|$)",true),
		MULTILINECOMMENT("/\\*(?:.|[\\n\\r])*?\\*/",true),
		BOOLEAN("true|false", false),
		REGULAREXPRESSION("/(?>[^\\\\/]|(\\\\.))*/", false);
		
		private String regexp;
		private boolean whitespace;

		BuiltinToken(String regexp, boolean whitespace) {
			this.regexp = regexp;
			this.whitespace = whitespace;
		}
		
		public TokenMatcher registerTokenMatcher(Grammar language) throws GrammarDefinitionException {
			return (TokenMatcher) language.addTokenmatcher(this.toString(), regexp, this.whitespace);
		}
	};
	
	/**
	 * Takes a willed arsed quess to confert a tokens text to a native java primitive, tries
	 * - boolean
	 * - long
	 * - float
	 * - quoted string
	 * - javascript style regex
	 * - return original input
	 * @param input
	 * @return
	 */
	public static Object textToValue(String input) {
		if (input == null)
			return null;
		if (input.matches("^"+BuiltinToken.BOOLEAN.regexp+"$"))
			return Boolean.parseBoolean(input);
		if (input.matches("^"+BuiltinToken.INTEGER.regexp+"$"))
			return Long.parseLong(input);
		if (input.matches("^"+BuiltinToken.FLOAT.regexp+"$"))
			return Double.parseDouble(input);
		if ((input.startsWith("'") && input.endsWith("'")) || (input.startsWith("\"") && input.endsWith("\"")))
			return Util.unescape(Util.substring(input, 1, -1));
		if (input.startsWith("/") && input.endsWith("/"))
			return Pattern.compile(Util.substring(input, 1, -1).replaceAll("\\\\([\\/])", "$1"));
		return input;
	}
	
	
    private Pattern regexp;
    private boolean isWhiteSpace;
    private boolean isKeyword;
	private String keyword;

    public TokenMatcher(Grammar language, String name, String regexp, boolean whiteSpace) {
        super(language, name);
        this.regexp = Pattern.compile("\\A" + regexp, Pattern.MULTILINE  &
            (language.getCaseInSensitive() ? Pattern.CASE_INSENSITIVE : 0)
        );
        this.isWhiteSpace = whiteSpace;
    }
    
    public Token match(String input) {
    	//System.out.println("About to match " + this.name + this.language.getName() + regexp.pattern());
        Matcher m = regexp.matcher(input);
        if (!m.find())
            return null;
        
        String text = input.substring(0, m.end());

        return new Token(this, text);
    }

    public boolean isWhiteSpace() {
        return isWhiteSpace;
    }

    @Override
    boolean performMatch(Parser parser, Match parent) {
    	int curpos = parent.getLastCharPos();
        String rest = parser.getInputString().substring(curpos);
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

    public String getName() {
        return name;
    }

    public String toString() {
        return String.format("[TokenMatcher '%s'->%s]", regexp.pattern(), this.name);
    }

    public String getRegexp() {
        return regexp.pattern();
    }

    /** indicates that this is a generated token, which should not be included in output etc */
    public void setIsKeyword(String keyword) {
    	this.keyword = keyword;
        this.isKeyword = true;		
    }

    public String getKeyword() { return keyword; }
    
    public boolean isKeyword() {
        return this.isKeyword;
    }

	@Override
	public Node toAST(Match match) {
		return new Node(this.name, match.getTerminal());
	}


}
package nl.mweststrate.miniup.util;

import java.util.LinkedList;
import java.util.Queue;

import nl.mweststrate.miniup.Node;
import nl.mweststrate.miniup.Miniup;
import nl.mweststrate.miniup.core.TestSuite;

public class CLI {


    private static Queue<String> mainArguments = new LinkedList<String>();
    
    /**
     * Processes command line arguments. Use the help command to find out which commands are available
     * @param args
     * @throws Exception
     */
    public static void main(String[] args) throws Exception {
    	for(int i = 0; i < args.length; i++)
    		mainArguments.add(args[i]);
    	
    	boolean showOutput = false;
    	String input = null;
    	String language = null;
    	String startSymbol = null;
    	long start = System.currentTimeMillis();

    	while(!mainArguments.isEmpty()) {
    		String cmd = mainArguments.poll();
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
    			String lib = mainArguments.poll();
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

    private static void p(String s) {
    	System.out.println(s);
    }
    
    private static void p(String flag, String arg, String help) {
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
    
	private static void printHelp() {
		p("Miniup parsing library CLI version 1.0");
		p("Written by Michel Weststrate, 2012, michel@mweststrate.nl");
		p("Vist the project at http://[githuburl]"); //TODO:
		p("");
		p("Command line arguments:");
		p("g","filename", "Parse using the grammar definition defined in [filename]");
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
package nl.mweststrate.miniup.util;

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
public class Pair<A, B> {
    private final A first;
    private final B second;

    public Pair(A first, B second) {
        this.first = first;
        this.second = second;
    }
    
    public static <C, D> Pair<C, D> pair(C first, D second) {
		return new Pair<C,D>(first, second);    	
    }

    public int hashCode() {
        int hashFirst = first != null ? first.hashCode() : 0;
        int hashSecond = second != null ? second.hashCode() : 0;

        return (hashFirst + hashSecond) * hashSecond + hashFirst;
    }

    @SuppressWarnings("unchecked")
	public boolean equals(Object other) {
        if (other instanceof Pair) {
                Pair<A, B> otherPair = (Pair<A,B>) other;
                return 
                ((  this.first == otherPair.first ||
                        ( this.first != null && otherPair.first != null &&
                          this.first.equals(otherPair.first))) &&
                 (      this.second == otherPair.second ||
                        ( this.second != null && otherPair.second != null &&
                          this.second.equals(otherPair.second))) );
        }

        return false;
    }

    public String toString()
    { 
           return "(" + first + ", " + second + ")"; 
    }

    public A getFirst() {
        return first;
    }

    public B getSecond() {
        return second;
    }
    
    public Pair<A, B> clone() {
    	return Pair.pair(first, second);
    }
}package nl.mweststrate.miniup.util;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.util.Collection;

/**
 * Some utility functions used by the parsers. You might find similar methods, probably faster, in apache commons.
 * Those are here just to make the parser dependency free.
 * @author michel
 *
 */
public class Util {
	
	/**
	 * Given a filename, returns it contents as string
	 * @param filePath
	 * @return
	 * @throws java.io.IOException
	 */
	public static String readFileAsString(String filePath) throws java.io.IOException{
        byte[] buffer = new byte[(int) new File(filePath).length()];
        BufferedInputStream f = new BufferedInputStream(new FileInputStream(filePath));
        f.read(buffer);
        return new String(buffer);
    }
	
	/**
	 * If idx is positive, returns the substring starting at the index, otherwise, return the substring ending at that index
	 * @param base
	 * @param idx
	 * @return
	 */
	public static String substring(String base, int idx) {
		if (idx >= 0)
			return substring(base, idx, 0);
		return substring(base, 0, idx);
	}
	
	/**
	 * Substring implementation that never throws an exception and can work with negative ranges, example:
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
	 * @param fromleft if positive, start index; if negative, string length
	 * @param fromright if negative, amount of characters from the end, if positive, string length
	 * @return
	 */
	public static String substring(String base, int fromidx, int toidx) {
		int from = fromidx;
		int len  = base.length();
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
		to   = Math.max(from, Math.min(to, len));
		
		return base.substring(from, to);
	}
	
	public static String leftPad(String string, int col) {
		int v = col;
		String r = "";
		while (v-- > 0)
			r += " ";
		return r + string;
	}

	public static String join(Collection<String> stuff, String separator) {
		StringBuilder b = new StringBuilder();
		int i = 0;
		for(String item : stuff) {
			b.append(item);
			if (i < stuff.size() -1)
				b.append(separator);
			i++;
		}
		return b.toString();
	}

	public static int countMatches(String input, String needle) {
		int r = 0;
		int p = 0;
		int i = 0;
		while((i = input.indexOf(needle, p)) != -1) {
			p = i + 1;
			r++;
		}
		return r;
	}

	public static String unescape(String text) {
    	//naive unescape function..
    	return text.replaceAll("\\\b", "\b")
        	.replaceAll("\\\t",  "\t")
        	.replaceAll("\\\n",  "\n")
        	.replaceAll("\\\f",  "\f")
        	.replaceAll("\\\r",  "\r")
        	.replaceAll("\\\\", "\\")
        	.replaceAll("\\'",  "'")
        	.replaceAll("\\\"", "\"");
	}


	public static String trimToLength(String string, int maxlength) {
		if (string == null || string.length() < maxlength)
			return string;
		return string.substring(0, maxlength);
	}
	
	public static String getInputLineByPos(String input, int position) {
		int prev = input.lastIndexOf('\n', position);
    	int next = input.indexOf('\n', position);
    	String line = Util.substring(input, prev +1 , Math.min(position + 20, next - prev));
    	return line.replaceAll("\t", " ");
	}
	
	public static String getInputLine(String input, int nr) {
		int cur = -1;
		for(int i = nr; i > 1; i--) {
			cur = input.indexOf('\n', cur +1);
			if (cur == -1)
				return null;					
		}
		
		int next = input.indexOf('\n', cur +1);
		String line;
		if (next == -1)
			line = input.substring(cur +1);
		else
			line = input.substring(cur +1, next);
		
		return line.replaceAll("\t", " "); //to fix highlighting for tabs. Better would be to insert a tabs before the cursor if needed
	}

	public static String hightlightLine(String inputString, int linenr,
			int colnr) {
		String msg = "at line " + linenr + " column " + colnr + ":\n\n";
		msg += getInputLine(inputString, linenr) + "\n"; 
    	msg += Util.leftPad("^", colnr -1);
		return msg;
	}
}
