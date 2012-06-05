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
