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
