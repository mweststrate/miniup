package nl.mweststrate.miniup;

import java.io.IOException;

import nl.mweststrate.miniup.core.Grammar;
import nl.mweststrate.miniup.core.GrammarBuilder;
import nl.mweststrate.miniup.core.GrammarDefinitionException;
import nl.mweststrate.miniup.core.ParseException;
import nl.mweststrate.miniup.util.Util;


public class Miniup {

	/**
	 * Public flag, if enabled, token memoization is enabled. This increases the member consumption of the parser,
	 * but might reduce the parse speed for grammars that are diffucult to parse. 
	 */
	public static boolean USE_TOKEN_MEMOIZATION = false;

	/**
	 * Public flag, if enabled, the full parse flow will be printed to stdout.
	 */
    public static boolean VERBOSE = false;
    
    /**
     * Public flag, if enabled, after each successful parse Miniup will show some statistics about the parse process,
     * for example the parse time, the number of items matched and the number of items tried but not matched.
     * For each number holds: Lower is better. 
     */
	public static boolean SHOWSTATS = true;

	/**
	 * Given a filename, the grammar in the file is parsed and a new grammar is build or an exception is trown. 
	 * 
	 * @param filename, the file to load
	 * @return the name of the grammar. Use this name for subsequent parse calls. 
	 * @throws GrammarDefinitionException
	 * @throws IOException
	 */
	public static String loadLanguageFromFile(String filename) throws GrammarDefinitionException, IOException {
		return loadLanguage(Util.readFileAsString(filename));
	}

	/**
	 * Makes sure that there is a grammar that can read grammars, to enable Miniup to read other grammars. Internally used when a new language needs to be parsed.
	 * @throws GrammarDefinitionException
	 */
	public static void bootstrap() throws GrammarDefinitionException {
		if (Grammar.languages.containsKey("Miniup"))
			return;
		try {
        	Grammar bootstrapper = GrammarBuilder.createBootstrapper();
        	bootstrapper.register();
        	
        } catch (Exception e) {
            throw new GrammarDefinitionException("Severe exception: failed to bootstrap the Miniup language!",e);
        }
	}
    
	/**
	 * Parses a grammar from a string.
	 * @param langDef
	 * @return The name of the language
	 * @throws GrammarDefinitionException
	 */
    public static String loadLanguage(String langDef) throws GrammarDefinitionException {
    	bootstrap();
    	
    	Node node;
		try {
			node = parse("Miniup", langDef);
		} catch (ParseException e) {
			throw new GrammarDefinitionException("Failed to parse language definition: " + e.getMessage(), e);
		}
    	Grammar l = GrammarBuilder.languageFromAST(node);
    	l.register();
    	return l.getName();
    }

    /**
     * Finds a grammar definition given a grammar name.
     * @param name
     * @return
     */
    public static Grammar getLanguage(String name) {
    	return Grammar.get(name);
    }
    
    /**
     * The real thing, transforms input to an Abstract Syntax Tree ( @see Node ) using a specific grammar.
     * Pre-condition: the grammar should already have been loaded.
     * @param languageName
     * @param input
     * @return
     * @throws ParseException
     */
    public static Node parse(String languageName, String input) throws ParseException {
    	return parse(languageName, input, null);
    }
    
    /**
     * @see Miniup.parse, but uses a specified start symbol instead of the default configured start symbol of the grammar. 
     * @param languageName
     * @param input
     * @param startSymbol
     * @return
     * @throws ParseException
     */
    public static Node parse(String languageName, String input, String startSymbol) throws ParseException {
    	return Grammar.get(languageName).parse(input, startSymbol).toAST();
    };
}
