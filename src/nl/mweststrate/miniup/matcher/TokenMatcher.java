package nl.mweststrate.miniup.matcher;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

import nl.mweststrate.miniup.Node;
import nl.mweststrate.miniup.Token;
import nl.mweststrate.miniup.core.Grammar;
import nl.mweststrate.miniup.core.GrammarDefinitionException;
import nl.mweststrate.miniup.core.Match;
import nl.mweststrate.miniup.core.Parser;
import nl.mweststrate.miniup.util.Util;


public class TokenMatcher extends AbstractMatcher {
	public static enum BuiltinToken {
		IDENTIFIER("[a-zA-Z_][a-zA-Z_0-9]*",false),
		WHITESPACE("\\s+",true),
		INTEGER("-?\\d+", false),
		FLOAT("-?\\d+(\\.\\d+)?(e\\d+)?", false),
		SINGLEQUOTEDSTRING("'(?>[^\\\\']|(\\\\[btnfr\"'\\\\]))*'",false),
		DOUBLEQUOTEDSTRING("\"(?>[^\\\\\"]|(\\\\[btnfr\"'\\\\]))*\"",false),
		SINGLELINECOMMENT("//[^\\n]*(\\n|$)",true),
		MULTILINECOMMENT("/\\*(?:.|[\\n\\r])*?\\*/",true),
		BOOLEAN("true|false", false),
		REGULAREXPRESSION("/(?>[^\\\\/]|(\\\\.))*/", false);
		
		private String regexp;
		private boolean whitespace;

		BuiltinToken(String regexp, boolean whitespace) {
			this.regexp = regexp;
			this.whitespace = whitespace;
		}
		
		public TokenMatcher registerTokenMatcher(Grammar language) throws GrammarDefinitionException {
			return (TokenMatcher) language.addTokenmatcher(this.toString(), regexp, this.whitespace);
		}
	};
	
	/**
	 * Takes a willed arsed quess to confert a tokens text to a native java primitive, tries
	 * - boolean
	 * - long
	 * - float
	 * - quoted string
	 * - javascript style regex
	 * - return original input
	 * @param input
	 * @return
	 */
	public static Object textToValue(String input) {
		if (input == null)
			return null;
		if (input.matches("^"+BuiltinToken.BOOLEAN.regexp+"$"))
			return Boolean.parseBoolean(input);
		if (input.matches("^"+BuiltinToken.INTEGER.regexp+"$"))
			return Long.parseLong(input);
		if (input.matches("^"+BuiltinToken.FLOAT.regexp+"$"))
			return Double.parseDouble(input);
		if ((input.startsWith("'") && input.endsWith("'")) || (input.startsWith("\"") && input.endsWith("\"")))
			return Util.unescape(Util.substring(input, 1, -1));
		if (input.startsWith("/") && input.endsWith("/"))
			return Pattern.compile(Util.substring(input, 1, -1).replaceAll("\\\\([\\/])", "$1"));
		return input;
	}
	
	
    private Pattern regexp;
    private boolean isWhiteSpace;
    private boolean isKeyword;
	private String keyword;

    public TokenMatcher(Grammar language, String name, String regexp, boolean whiteSpace) {
        super(language, name);
        this.regexp = Pattern.compile("\\A" + regexp, Pattern.MULTILINE  &
            (language.getCaseInSensitive() ? Pattern.CASE_INSENSITIVE : 0)
        );
        this.isWhiteSpace = whiteSpace;
    }
    
    public Token match(String input) {
    	//System.out.println("About to match " + this.name + this.language.getName() + regexp.pattern());
        Matcher m = regexp.matcher(input);
        if (!m.find())
            return null;
        
        String text = input.substring(0, m.end());

        return new Token(this, text);
    }

    public boolean isWhiteSpace() {
        return isWhiteSpace;
    }

    @Override
    boolean performMatch(Parser parser, Match parent) {
    	int curpos = parent.getLastCharPos();
        String rest = parser.getInputString().substring(curpos);
        Token next = this.match(rest);
        
        if (next != null) {
            
            //if (Miniup.VERBOSE &&  !next.getText().trim().isEmpty())
        	//	System.out.println(" -- " + this.name + " --> `" + next.getText() + "`");
            
        	next.setCoords(parser.getCurrentLineNr(curpos), parser.getCurrentColNr(curpos));
            parent.setTerminal(next);
            parent.eat(next.getText().length());
            return true;
        }
        return false;
    }

    public String getName() {
        return name;
    }

    public String toString() {
        return String.format("[TokenMatcher '%s'->%s]", regexp.pattern(), this.name);
    }

    public String getRegexp() {
        return regexp.pattern();
    }

    /** indicates that this is a generated token, which should not be included in output etc */
    public void setIsKeyword(String keyword) {
    	this.keyword = keyword;
        this.isKeyword = true;		
    }

    public String getKeyword() { return keyword; }
    
    public boolean isKeyword() {
        return this.isKeyword;
    }

	@Override
	public Node toAST(Match match) {
		return new Node(this.name, match.getTerminal());
	}


}
