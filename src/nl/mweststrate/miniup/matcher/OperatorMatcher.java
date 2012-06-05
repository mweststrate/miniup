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
