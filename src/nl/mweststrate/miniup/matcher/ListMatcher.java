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
