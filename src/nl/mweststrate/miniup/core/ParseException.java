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
