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
