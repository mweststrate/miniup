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
}