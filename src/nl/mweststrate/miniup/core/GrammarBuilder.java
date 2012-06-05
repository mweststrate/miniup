package nl.mweststrate.miniup.core;

import java.util.ArrayList;
import java.util.List;

import nl.mweststrate.miniup.Node;
import nl.mweststrate.miniup.matcher.AbstractMatcher;
import nl.mweststrate.miniup.matcher.ChoiceMatcher;
import nl.mweststrate.miniup.matcher.ImportMatcher;
import nl.mweststrate.miniup.matcher.ListMatcher;
import nl.mweststrate.miniup.matcher.OperatorMatcher;
import nl.mweststrate.miniup.matcher.SequenceMatcher;
import nl.mweststrate.miniup.matcher.SetMatcher;
import nl.mweststrate.miniup.matcher.TokenMatcher;
import nl.mweststrate.miniup.matcher.SequenceMatcher.SequenceItem;
import nl.mweststrate.miniup.matcher.TokenMatcher.BuiltinToken;

public class GrammarBuilder {

    public static Grammar languageFromAST(Node langNode) throws GrammarDefinitionException {
        try {
	    	Node t = langNode;//.get(0);
	    	Grammar b = new Grammar(t.get(0).text());
	        for(Node option : t.get(1)) {
	        	String name = option.terminal().text();
	        	String value = option.isTerminal() ? "true" : option.findText(1);
	        	
	            if (name.equals("casesensitive"))
	                b.setCaseInsensitive(!Boolean.parseBoolean(value));
	            else if (name.equals("disableautowhitespace"))
	            	b.setDisableAutoWhitespace(Boolean.parseBoolean(value));
	            else if (name.equals("startsymbol"))
	                b.setStartSymbol(value);
	            else if (name.equals("usedefaulttokens")) {
	            	if ("true".equals(value))
	            		addDefaultTokens(b);
	            }
	            else
	                throw new IllegalArgumentException("Error while creating language: Option '" + option.findText(0)+ "' is unknown.");
	        }
	        for(Node def : t.get(2)) {
	            AbstractMatcher m = null;
	            if (def.is("tokenDef"))
	                m = parseTokenDef(b, def);
	            else if (def.is("sequenceDef"))
	                m = parsesequenceDef(b, def.findText(0), def.get(2));
	            else if (def.is("listDef"))
	                m = parseListDef(b, def);
	            else if (def.is("setDef"))
	                m = parseSetDef(b, def);
	            else if (def.is("opDef"))
	                m = parseOpDef(b, def);
	            else if (def.is("choiceDef"))
	                m = parseChoiceDef(b, def.findText(0), def.get(2));
	            else if (def.is("importDef"))
	            	m = parseImportDef(b, def.findText(0), def.findText(2), def.findText(3));
	            else
	            	throw new GrammarDefinitionException("Unimplemented defintion type:" + def.name());
	            
	            for(Node option : def.get(1)) {
	            	if (option.isTerminal())
	            		m.setOption(option.text(), true);
	            	else
	            		m.setOption(option.findText(0), option.get(1).terminal().value());
	            }
	       }
	        return b;
        }
        catch(Exception e) {
        	throw new GrammarDefinitionException("Failed to construct language: " + e.getMessage(), e);
        }
    }

    private static AbstractMatcher parseChoiceDef(Grammar b, String name, Node choices) throws ParseException, GrammarDefinitionException {
    	List<String> items = new ArrayList<String>();
    	for (Node child : choices)
    		items.add(toTerminalName(b, child));
    	
		ChoiceMatcher rule = new ChoiceMatcher(b, name, items.toArray(new String[items.size()]));
		b.addRule(rule);
		return rule;
	}

    private static AbstractMatcher parseImportDef(Grammar b, String name, String languagename, String rulename) throws ParseException, GrammarDefinitionException {
		ImportMatcher rule = new ImportMatcher(b, name, languagename, rulename);
		b.addRule(rule);
		return rule;
	}    
    
	private static AbstractMatcher parseOpDef(Grammar b, Node def) throws ParseException, GrammarDefinitionException {
    	OperatorMatcher rule = new OperatorMatcher(b, def.findText(0), true, 
    			toTerminalName(b, def.get(2)), 
    			toTerminalName(b, def.get(3)));
    	b.addRule(rule);
    	return rule;
	}

	private static AbstractMatcher parseSetDef(Grammar b, Node def) throws ParseException, GrammarDefinitionException {
    	String seperatorOrNull = null;
		String preOrNull = null;
		String postOrNull = null;
		
		if (!def.get(3).isLambda()) { //matched 'using'?
			Node items = def.get(4);
			switch(items.size()) {
				case 1: seperatorOrNull = toTerminalName(b, items.get(0));
					break;
				case 3:
					preOrNull = toTerminalName(b, items.get(0));
					postOrNull = toTerminalName(b, items.get(2));
					seperatorOrNull = toTerminalName(b, items.get(1));
					break;
				default: throw new RuntimeException("Error in rule '" + def.findText(0) + "' of type set definition should contain 1 or 3 'using' elements. ");
			}
		}
		
		List<String> items = new ArrayList<String>();
		for(Node choice : def.get(2)) {
			items.add(toTerminalName(b, choice));
		}
		
		SetMatcher rule = new SetMatcher(b, def.findText(0), seperatorOrNull, preOrNull, postOrNull, items.toArray(new String[items.size()]));
		b.addRule(rule);
		return rule;
	}

	private static AbstractMatcher parseListDef(Grammar b, Node def) throws ParseException, GrammarDefinitionException {
        Node items = def.get(2);

        return constructList(b, def.findText(0), items);
    }

    private static AbstractMatcher parsesequenceDef(Grammar b, String name, Node items) throws ParseException, GrammarDefinitionException {
        SequenceMatcher rule = new SequenceMatcher(b, name);
        b.addRule(rule);
        for (Node item : items) {
            //0 = value, 1 = '?' -> required, 2 = options
            rule.addItem(new SequenceItem(toTerminalName(b, item.get(1)), item.get(2).isLambda(), item.get(0).isLambda() ? null : item.findText(0)));
        }
        return rule;
    }
    
    //given a token 'xyz' or xyz, returns the token, or the generated name for the terminal
    //TODO:has to change, tokens and ids are parsed in another way
    private static String toTerminalName(Grammar b, Node astNode) throws GrammarDefinitionException, ParseException {
    	if (astNode.isTerminal()) {
	    	String text = astNode.text();
	    	if (text.startsWith("'") || text.startsWith("\"")) 
	            return b.keyword((String) astNode.value());
	        return text;
    	}
    	else {
    		String name = "subrule_" + (b.subruleCount++);
    		if (astNode.is("listSubrule")) { //List
    			constructList(b, name, astNode.get(0));
    		}
    		else if (astNode.is("choiceSubrule")) {
    			parseChoiceDef(b, name, astNode);
    		}
    		else if (astNode.is("sequenceSubrule")) {
    			parsesequenceDef(b, name, astNode);
    		}
    		else
    			throw new GrammarDefinitionException("Not implemented def: " + astNode.name());
    		
    		return name;
    	}
    }
    
    private static ListMatcher constructList(Grammar b, String name, Node items) throws ParseException, GrammarDefinitionException {
        //1 item = value, 2 items = value, seperator, 4 items = 
        String token = null;
        String separator = null;
        String pre = null;
        String post = null;
        
        switch (items.size()) {
        case 1:
        	token = toTerminalName(b, items.get(0));
        	break;
        case 2:
        	token = toTerminalName(b, items.get(0));
        	separator = toTerminalName(b, items.get(1));
        	break;
        case 3:
        	pre = toTerminalName(b, items.get(0));
        	token = toTerminalName(b, items.get(1));
        	post = toTerminalName(b, items.get(2));
        	break;
        case 4:
        	pre = toTerminalName(b, items.get(0));
        	token = toTerminalName(b, items.get(1));
        	separator = toTerminalName(b, items.get(2));
        	post = toTerminalName(b, items.get(3));
        	break;
        	default: throw new RuntimeException("Error in rule '" + name + "' of type list definition should contain 1 to 4 elements. ");
        }
    	
    	ListMatcher rule = new ListMatcher(b, name, token, separator, pre, post);
        b.addRule(rule);
        return rule;
	}

	private static boolean hasOption(Node def, String option) {
        for(Node opt : def.get(1)) {
        	if (opt.isTerminal() && opt.text().equals(option)) //simple 
    			return true;
            else if (!opt.isTerminal() && opt.findText(0).equals(option))
                return (Boolean) opt.get(1).terminal().value(Boolean.TRUE);
        }
        return false;
    }

    private static AbstractMatcher parseTokenDef(Grammar b, Node def) throws ParseException, GrammarDefinitionException {
    	String regexp = (def.get(2).text());
    	regexp = regexp.substring(1, regexp.length()-1).replaceAll("\\\\([\\/])", "$1");
        return b.addTokenmatcher(def.findText(0), regexp, hasOption(def, "whitespace"));
    }

    public static Grammar createBootstrapper() throws ParseException, GrammarDefinitionException {
//    	language nl.mweststrate.miniup
//   	[
//    	casesensitive = true,
//    	startsymbol = langdef
//    	]
//    	token Comments1 [whitespace,style='color:green;font-style:italic'] 	: '//[^\\n]*\\n';
//    	token Comments2 [whitespace] 	: '/\\*(?:.|[\\n\\r])*?\\*/';
//    	token Whitespace [whitespace] 	: '\\s+';
//    	token ID 						: '[a-zA-Z_][a-zA-Z_0-9]*';
//    	token StringSingle 				: '\'([^\\\\]|(\\\\.))*?\'';
//  	token StringDouble 				: '"([^\\\\]|(\\\\.))*?"';
//        token RegExp : '/([^/]|(\\/))*?/'
        Grammar b = new Grammar("Miniup");
        b.setCaseInsensitive(true);

        addDefaultTokens(b);
        //TokenMatcher.BuiltinToken.SINGLELINECOMMENT.
//        b.addTokenmatcher("Comments1", "//[^\\n]*\\n", true);
        //based on http://ostermiller.org/findcomment.html:
  //      b.addTokenmatcher("Comments2", "/\\*(?:.|[\\n\\r])*?\\*/", true);
    //    b.addTokenmatcher("whitespace","\\s+", true);
      //  b.addTokenmatcher("ID","[a-zA-Z_][a-zA-Z_0-9]*", false);
        //b.addTokenmatcher("StringSingle","'([^\\\\]|(\\\\.))*?'", false);
       // b.addTokenmatcher("StringSingle","'([^\\\\]|(\\\\.))*?'", false);
        //b.addTokenmatcher("RegExp", "/([^\\\\/]|(\\\\.))*/", false);
        //b.addTokenmatcher("StringSingle","'([\\\\\\n\\r\\t]|[^\\\\'])*'", false);

/*
        sequence langdef 	: 'language' ID options definitions;
        list options 			: '[' option ',' ']';
        choice option[nonode] 	: valueoption | simpleoption;
        simpleoption 			: ID;
        valueoption 			: ID '=' value;  
*/
        b.addSequence("langdef", 
        		new SequenceItem(b.keyword("language")), 
        		new SequenceItem("IDENTIFIER"), 
        		new SequenceItem("options"), 
        		new SequenceItem("definitions"));
        
        b.addList("options", true, "option", b.keyword(","), b.keyword("["), b.keyword("]"), false);
        b.addChoice("option", "valueoption", "IDENTIFIER");
        
        b.addSequence("valueoption", 
        		new SequenceItem("IDENTIFIER"), 
        		new SequenceItem(b.keyword(":")), 
        		new SequenceItem("value"));
        
/*        
        list definitions 		: definition ';';
        choice definition 		: tokenDef | choiceDef | sequenceDef | listDef | setDef;

        sequence tokenDef 	: 'token' ID options? ':' StringSingle;

        sequence choiceDef 	: 'choice' ID options? ':' choices;
        list choices 			: value '|';
*/
        b.addList("definitions", false, "definition", b.keyword(";"), null, null, true);
        b.addChoice("definition", "tokenDef","choiceDef", "sequenceDef", "listDef", "setDef", "opDef", "importDef");
        
        b.addSequence("tokenDef", 
        		new SequenceItem(b.keyword("token")), 
				new SequenceItem("IDENTIFIER"), 
				new SequenceItem("options", false), 
				new SequenceItem(b.keyword("=")), 
				new SequenceItem("REGULAREXPRESSION"));
 
        b.addSequence("choiceDef", 
        		new SequenceItem(b.keyword("choice")), 
        		new SequenceItem("IDENTIFIER"), 
        		new SequenceItem("options", false), 
        		new SequenceItem(b.keyword("=")), 
        		new SequenceItem("choices"));

        b.addList("choices", false, "value", b.keyword("|"), null, null, false);
        
/*        
        sequence sequenceDef 	: 'sequenceosition' ID options? ':' sequenceItems;
        list sequenceItems 			: sequenceItem;
        sequence sequenceItem 	: value '?'? sequenceItemOptions?;
        set sequenceItemsOptions 	: 'newline' | 'indent' | 'outdent' | 'merge' using '[' ',' ']';

*/
        b.addSequence("sequenceDef", 
        		new SequenceItem(b.keyword("sequence")), 
        		new SequenceItem("IDENTIFIER"), 
        		new SequenceItem("options", false), 
        		new SequenceItem(b.keyword("=")), 
        		new SequenceItem("sequenceItems"));

        b.addList("sequenceItems", false, "sequenceItem", null, null, null, false);
        
        b.addSequence("sequenceItemName",
        		new SequenceItem("IDENTIFIER"),
        		new SequenceItem(b.keyword(":")));
        
        b.addSequence("sequenceItem",
        		new SequenceItem("sequenceItemName", false),
        		new SequenceItem("value"), 
        		new SequenceItem(b.keyword("?"), false));
        //r = b.addSequence("sequenceItem", "value", b.keyword("?"), "sequenceItemOptions");
        
        b.addSet("sequenceItemOptions", b.keyword(","), b.keyword("["), b.keyword("]"), b.keyword("newline"), b.keyword("indent"), b.keyword("outdent"), b.keyword("merge"));
/*
        sequence listDef		: 'list' ID options? ':' values;
        sequence setDef		: 'set'  ID options? ':' choices 'using'? values?; 
        
        list values 			: value;
        choice value 			: String | ID;
        choice String 			: StringSingle; // StringDouble ; 
*/
        b.addSequence("listDef", 
        		new SequenceItem(b.keyword("list")), 
        		new SequenceItem("IDENTIFIER"),
        		new SequenceItem("options", false), 
        		new SequenceItem(b.keyword("=")), 
        		new SequenceItem("values"));

        b.addSequence("setDef", 
        		new SequenceItem(b.keyword("set")), 
        		new SequenceItem("IDENTIFIER"), 
        		new SequenceItem("options", false), 
        		new SequenceItem(b.keyword("=")), 
        		new SequenceItem("choices"), 
        		new SequenceItem(b.keyword("using"), false), 
        		new SequenceItem("values", false));
        /* sequence opDef = 'operator' IDENTIFIER options? '=' value value; */
        b.addSequence("opDef", 
        		new SequenceItem(b.keyword("operator")),
        		new SequenceItem("IDENTIFIER"),
        		new SequenceItem("options", false),
        		new SequenceItem(b.keyword("=")),
        		new SequenceItem("value"),
        		new SequenceItem("value")
        );
        
        /* sequence importDef = 'import' IDENTIFIER options? '=' languagename:IDENTIFIER rulename: IDENTIFIER?; */
        b.addSequence("importDef", 
        		new SequenceItem(b.keyword("import")),
        		new SequenceItem("IDENTIFIER"),
        		new SequenceItem("options", false),
        		new SequenceItem(b.keyword("=")),
        		new SequenceItem("IDENTIFIER"),
        		new SequenceItem(b.keyword(".")),
        		new SequenceItem("IDENTIFIER")
        );
        
        b.addList("values", false, "value", null, null, null, false);
        b.addChoice("value", "SINGLEQUOTEDSTRING", "IDENTIFIER", "subRule");
        
/*        choice Subrule =  ListSubrule | ChoiceSubrule | sequenceSubrule;

        sequence ListSubrule = '(' values ')' '*'; //list is prefered above the others as it disambiguates by '*'
        list ChoiceSubrule      = '(' value '|' ')'; //note that this one is ambigue with CombSubrule for '(' A ')'. That doesn't matter as they do effectively the same
        list sequenceSubrule        = '(' sequenceItem ')';
*/
        b.addChoice("subRule", "listSubrule", "choiceSubrule", "sequenceSubrule");
        b.addSequence("listSubrule", 
        		new SequenceItem(b.keyword("(")), 
        		new SequenceItem("values"), 
        		new SequenceItem(b.keyword(")")), 
        		new SequenceItem(b.keyword("*")));
        
        b.addList("choiceSubrule", false, "value", b.keyword("|"), b.keyword("("), b.keyword(")"), false);
        b.addList("sequenceSubrule", false, "sequenceItem", null, b.keyword("("), b.keyword(")"), false);
        //b.addChoice("String", items)
        b.setStartSymbol("langdef");
        return b;
        
    }

	private static void addDefaultTokens(Grammar b)
			throws GrammarDefinitionException {
		for(BuiltinToken tm : TokenMatcher.BuiltinToken.values())
        	tm.registerTokenMatcher(b);
	}

}
