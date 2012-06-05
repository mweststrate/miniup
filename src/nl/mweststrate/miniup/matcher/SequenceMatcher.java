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

}