package nl.mweststrate.miniup.matcher;

import nl.mweststrate.miniup.Node;
import nl.mweststrate.miniup.core.Grammar;
import nl.mweststrate.miniup.core.Match;
import nl.mweststrate.miniup.core.ParseException;
import nl.mweststrate.miniup.core.Parser;

public class ImportMatcher extends AbstractMatcher {

	private String languagename;
	private String rulename;

	public ImportMatcher(Grammar language, String name, String languagename, String rulename) {
		super(language, name);
		this.languagename = languagename;
		this.rulename = rulename;
	}

	@Override
	boolean performMatch(Parser parser, Match parent) throws ParseException {
		if (!Grammar.languages.containsKey(languagename))
			throw new ParseException(parser, false, "Grammar import '" + languagename + "' could not be resolved!\n");
		
        try {
        	return Grammar.get(languagename).parsePartial(parser, parent, rulename);
        }
        catch (ParseException inner) {
        	//TODO: wrap exception? calculate real coordinates?
        	throw inner;
        }
	}

	@Override
	public Node toAST(Match match) {
		Node inner = match.getLastMatch(true).toAST(); 
		if (Boolean.FALSE.equals(this.getOption("wrap", Boolean.TRUE))) //nowrap?
			return inner;
		
		return new Node(this.getName(), inner);
	}

}
