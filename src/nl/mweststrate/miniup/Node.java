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
