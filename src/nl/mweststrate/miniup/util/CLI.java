package nl.mweststrate.miniup.util;

import java.util.LinkedList;
import java.util.Queue;

import nl.mweststrate.miniup.Node;
import nl.mweststrate.miniup.Miniup;
import nl.mweststrate.miniup.core.TestSuite;

public class CLI {


    private static Queue<String> mainArguments = new LinkedList<String>();
    
    /**
     * Processes command line arguments. Use the help command to find out which commands are available
     * @param args
     * @throws Exception
     */
    public static void main(String[] args) throws Exception {
    	for(int i = 0; i < args.length; i++)
    		mainArguments.add(args[i]);
    	
    	boolean showOutput = false;
    	String input = null;
    	String language = null;
    	String startSymbol = null;
    	long start = System.currentTimeMillis();

    	while(!mainArguments.isEmpty()) {
    		String cmd = mainArguments.poll();
			if ("-T".equals(cmd)) {
				Miniup.bootstrap();
    			TestSuite.runTestsuite();
    		}
    		else if ("-v".equals(cmd)) 
    			Miniup.VERBOSE = true;
    		else if (("-h").equals(cmd)) 
    			printHelp();
    		else if ("-o".equals(cmd)) 
    			showOutput = true;
    		else if ("-i".equals(cmd)) 
    			input = Util.readFileAsString(mainArguments.poll());
    		else if ("-t".equals(cmd)) 
    			input = mainArguments.poll();
    		else if ("-g".equals(cmd))
    			language = mainArguments.poll();
    		else if ("-S".equals(cmd))
    			Miniup.SHOWSTATS = true;
    		else if ("-c".equals(cmd))
    			Miniup.USE_TOKEN_MEMOIZATION = true;
    		else if ("-s".equals(cmd))
    			startSymbol = mainArguments.poll();
    		else if ("-l".equals(cmd)) {
    			String lib = mainArguments.poll();
    			Miniup.loadLanguageFromFile(lib);
    			p("  Loaded grammar as library: " + lib);
    		}
    		else
    			throw new IllegalArgumentException("Unknown option: '" + cmd + "'");
    	}
    	
    	if (input != null) {
    		System.out.println("Preparing parse");
    		
    		if (language == null) {
    			Miniup.bootstrap();
    			language = "Miniup";
    		}
    		else 
    			language = Miniup.loadLanguageFromFile(language);
    		
    		System.out.println("Loaded language '" + language + "'");
    		
    		Node node = Miniup.parse(language, input, startSymbol);
    		
    		System.out.println("Parse succeeded :)"); 
    		
    		if (showOutput)
    			System.out.println(node.toMultilineString());
    		
    	}
    	if (Miniup.SHOWSTATS)
    		System.out.println("Total time: " + (System.currentTimeMillis() - start) + " ms.");
    	
    	System.exit(0);
    }

    private static void p(String s) {
    	System.out.println(s);
    }
    
    private static void p(String flag, String arg, String help) {
    	System.out.print("\t-");
    	System.out.print(flag);
    	System.out.print("\t");
    	if (arg != null)
    		System.out.print("[" + arg + "]");
    	else
    		System.out.print("\t");
    	System.out.print("\t");
    	p(help);
    }
    
	private static void printHelp() {
		p("Miniup parsing library CLI version 1.0");
		p("Written by Michel Weststrate, 2012, michel@mweststrate.nl");
		p("Vist the project at http://[githuburl]"); //TODO:
		p("");
		p("Command line arguments:");
		p("g","filename", "Parse using the grammar definition defined in [filename]");
		p("i", "filename", "Use the given file as input for the parser");
		p("");
		p("c", null, "Use token memoization, might increase the parse speed at the cost of memory consumption");
		p("h", null, "Prints this help message");
		p("l", "filename", "Loads an additional grammar definition, to be able to resolve 'import' rules");
		p("o", null, "Prints the AST created by the parser to stdout");
		p("s", "rulename", "Use the given rulename as start symbol while parsing");
		p("S", null, "Print statistics after the parsing has finished");
		p("t", "sometext", "Use the provided text as input for the parser");
		p("T", null, "Run the internal test suite");
		p("v", null, "Verbose mode. Prints all match attemps of the parser to stdout");
	}
}
