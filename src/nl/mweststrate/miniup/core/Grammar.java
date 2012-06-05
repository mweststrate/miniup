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
