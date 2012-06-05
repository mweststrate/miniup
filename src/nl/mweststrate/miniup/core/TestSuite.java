package nl.mweststrate.miniup.core;

import java.io.IOException;

import nl.mweststrate.miniup.Node;
import nl.mweststrate.miniup.matcher.SequenceMatcher;
import nl.mweststrate.miniup.matcher.SequenceMatcher.SequenceItem;
import nl.mweststrate.miniup.util.Util;

public class TestSuite {

	public static void runTestsuite() throws Exception, ParseException, IOException {
		test1();
	    test2();
	    test3();
	    test4();
	    //System.exit(0);
	    Grammar b = GrammarBuilder.createBootstrapper();
	    
	    //run sugar test
	    GrammarBuilder.languageFromAST(Grammar.get("Miniup").parse(Util.readFileAsString("res/sugartest.txt")).toAST());
	    
	    Node n = Grammar.get("sugartest").parse(
	    	"sublist bla boe > subchoice 'hoi' subcomp zeker"	
	    ).toAST();
	    
	    test(n.toString(),
	    "(test (subrule_1 'bla' 'boe') ''hoi'' (subrule_3 - 'zeker'))");

	    test(n.get("jatoch").findText(1), "zeker");
	    test(n.get("ids").toString(), "(subrule_1 'bla' 'boe')");
	    test(n.get("string").text(), "'hoi'");
	    
	    //load Miniup from the official def, should behave the same..
	    String data;
	    data = Util.readFileAsString("res/miniup.txt");
	    
	    //test bootstrap
	    Match m = b.parse(data);
	    
	    Node t = m.toAST();
	    System.out.println(t);
	    Grammar b2 = GrammarBuilder.languageFromAST(t);
	    
	    //try to parse ourselves a few times... that makes a nice unit test
	    for(int i = 0; i < 3; i++) {
	    	System.out.println("Yeaah, parsed for the " + (i + 1) + " time");
	    	m = b2.parse(data);
	    	t = m.toAST();
	    	b2 = GrammarBuilder.languageFromAST(t);
	    }
	    
	    //Match m = b.parse(data);
	    //System.out.println(m);
	    
	    GrammarBuilder.languageFromAST(Grammar.get("Miniup").parse(Util.readFileAsString("res/sugartest.txt")).toAST());
	    
	    n = Grammar.get("sugartest").parse(
	    	"sublist bla boe > subchoice 'hoi' subcomp zeker"	
	    ).toAST();
	    
	    test(n.toString(),
	    "(test (subrule_1 'bla' 'boe') ''hoi'' (subrule_3 - 'zeker'))");
	    
	    test(n.get("jatoch").findText(1), "zeker");
	    test(n.get("ids").toString(), "(subrule_1 'bla' 'boe')");
	    test(n.get("string").text(), "'hoi'");
	    
	    System.out.println("Finished!");
	}

	
    @SuppressWarnings("unused")
    private static void test1() throws Exception {
        String data = Util.readFileAsString("res/test1.txt");
        
        Grammar bootstrap = new Grammar("test1");
        bootstrap.addTokenmatcher("identifier","\\w+", false);
        bootstrap.addTokenmatcher("whitespace","\\s+", true);
        bootstrap.addTokenmatcher("number","\\d+", true);
        bootstrap.keyword("bla");
        bootstrap.keyword("bla");
        bootstrap.keyword(">=");
        bootstrap.keyword("==");
        bootstrap.keyword(">");
        bootstrap.keyword("=");
    }

    private static void test2() throws Exception {
        
        Grammar x = new Grammar("test2");
        String ID = "identifier";
        x.addTokenmatcher("identifier","\\w+", false);
        x.addTokenmatcher("whitespace","\\s+", true);
        x.addTokenmatcher("number","\\d+", true);

        SequenceMatcher hw = x.addSequence("hw", new SequenceItem(ID), new SequenceItem(ID, false));

        x.setStartSymbol(hw.getName());
        Match m = x.parse("hello");
        test(m.toMatchString(), "(hw: 'hello' -)");
     
        Match m2 = x.parse("hello world");
        test(m2.toMatchString(), "(hw: 'hello' 'world')");
      
        String o = x.keyword("other");
        String p = x.keyword("planet");
        x.setStartSymbol(x.addChoice("op", o, p));
        test(x.parse("  planet  \n").toMatchString(),"(op: planet)");
        
        x.setStartSymbol(x.addList("list1", true, ID, null, o, p, true));
        test(x.parse("other planet").toMatchString(),"(list1: other planet)");
        test(x.parse("other blaat blaat planet").toMatchString(),"(list1: other 'blaat' 'blaat' planet)");

        x.setStartSymbol(x.addList("list2", true, ID, x.keyword(","), o, p, true));
       // test(x.parse("other planet").toAST().toString(),"(list2 (list2))");
        test(x.parse("other hoi , hoi planet").toAST().toString(),"(list2 'hoi' 'hoi')");  
        test(x.parse("other hoi , hoi, planet").toAST().toString(),"(list2 'hoi' 'hoi')");
        test(x.parse("other oi,planet").toMatchString(),"(list2: other 'oi' , planet)");
        test(x.parse("other blaat, blaat planet").toMatchString(),"(list2: other 'blaat' , 'blaat' planet)");
        
        x.addList("planets", true, "identifier", null, null, null, false);
        x.addSequence("emptyListEOF", new SequenceItem("identifier"), new SequenceItem("planets")); 
        //MWE: bug found: this should not throw EOF!
        test(x.parse("bladibla", "emptyListEOF").toMatchString(), "(emptyListEOF: 'bladibla' (planets:))");
        
    }
    
    private static void test3() throws Exception {
        //language without backtracking
        Grammar x = new Grammar("test3");
        x.addTokenmatcher("whitespace","\\s+", true);
        String Number = "number";
        x.addTokenmatcher("number","\\d+", false);
        
        String mul = x.addOperator("mul", true, x.keyword("*"), Number);
        String add = x.addOperator("add", false, x.keyword("+"),mul);
        String Expr = x.addChoice("expr", add);
        x.setStartSymbol(Expr);

  /*      test(x.parse("1 * 2").toMatchString(), "(expr: (add: (mul: '1' * '2')))");
        test(x.parse("1 * 2 * 3").toMatchString(), "(expr: (add: (mul: '1' * '2' * '3')))");
        test(x.parse("1 + 2 + 3").toMatchString(), "(expr: (add: (mul: '1') + (add: (mul: '2') + (add: (mul: '3')))))");
        test(x.parse("1 * 2 + 3 * 4").toMatchString(), "(expr: (add: (mul: '1' * '2') + (add: (mul: '3' * '4'))))");
        test(x.parse("1 + 2 + 3 * 4 * 5 * 6").toMatchString(), "(expr: (add: (mul: '1') + (add: (mul: '2') + (add: (mul: '3' * '4' * '5' * '6')))))");
   */     
        test(x.parse("1 * 2").toAST().toString(), "(mul '*' '1' '2')");
        test(x.parse("1 * 2 * 3").toAST().toString(), "(mul '*' (mul '*' '1' '2') '3')");
        test(x.parse("1 + 2 + 3").toAST().toString(), "(add '+' '1' (add '+' '2' '3'))");
        test(x.parse("1 * 2 + 3 * 4").toAST().toString(), "(add '+' (mul '*' '1' '2') (mul '*' '3' '4'))");
        test(x.parse("1 + 2 + 3 * 4 * 5 * 6").toAST().toString(), "(add '+' '1' (add '+' '2' (mul '*' (mul '*' (mul '*' '3' '4') '5') '6')))");
        test(x.parse("1 + 2 + 3 * 4 * 5 + 6 * 2 + 7").toAST().toString(), "(add '+' '1' (add '+' '2' (add '+' (mul '*' (mul '*' '3' '4') '5') (add '+' (mul '*' '6' '2') '7'))))");
    }
    
    private static void test4() throws Exception {
        //language with backtracking
        Grammar x = new Grammar("test4");
        x.setBacktracking(50);
        x.addTokenmatcher("whitespace","\\s+", true);
        String Number = "number";
        x.addTokenmatcher("number","\\d+", false);
        
        String mul = x.addOperator("mul", true, x.keyword("*"), "expr");
        String add = x.addOperator("add", false, x.keyword("+"),"expr");
        x.addSequence("paren", 
        		new SequenceItem(x.keyword("(")), 
        		new SequenceItem("expr"), 
        		new SequenceItem(x.keyword(")")));
        String Expr = x.addChoice("expr", add,mul,Number, "paren");
        x.setStartSymbol(Expr);
//TODO: matchstring depends on stack, how to optimize?
  //      test(x.parse("1 * 2").toMatchString(), "(expr: (mul: (expr: '1') * (expr: '2')))");
 //      test(x.parse("1 + 2 + 3 * 4 * 5 * 6").toMatchString(), "(expr: (add: (mul: '1') + (add: (mul: '2') + (add: (mul: '3' * '4' * '5' * '6')))))");
        
   //     test(x.parse("1 * 2").toAST().toString(), "(expr (mul '*' '1' '2'))");
//        test(x.parse("1 * 2 * 3").toAST().toString(), "(expr (mul '*' (mul '*' '1' '2') '3'))");
        test(x.parse("1 + 2 + 3").toAST().toString(), "(add '+' '1' (add '+' '2' '3'))");   
        test(x.parse("1 + 2 + 3 * 4 * 5 * 6").toAST().toString(), "(add '+' '1' (add '+' '2' (mul '*' (mul '*' (mul '*' '3' '4') '5') '6')))");
        test(x.parse("1 + 2 + 3 * 4 * 5 + 6 * 2 + 7").toAST().toString(), "(add '+' '1' (add '+' '2' (add '+' (mul '*' (mul '*' '3' '4') '5') (add '+' (mul '*' '6' '2') '7'))))");

        test(x.parse("(1 + 2) + 3").toAST().toString(), "(add '+' (paren (add '+' '1' '2')) '3')");

        test(x.parse("1 + (2 + 3) * 4 * (5 * 6)").toAST().toString(), 
        "(add '+' '1' (mul '*' (mul '*' (paren (add '+' '2' '3')) '4') (paren (mul '*' '5' '6'))))");
        test(x.parse("(1 + 2) * 3 + 4 * (5 + 6) + (6 + 7) * 8").toAST().toString(),
        		"(add '+' (mul '*' (paren (add '+' '1' '2')) '3') (add '+' (mul '*' '4' (paren (add '+' '5' '6'))) (mul '*' (paren (add '+' '6' '7')) '8')))");
        
    }    
    
    //TODO: add test for SetMatcher
    //TODO: add test for endless recursion and list lambda productions
    private static void test(String ast, String string) {
        System.out.println(ast);
        if (!ast.trim().equals(string))
            throw new AssertionError("TEST FAILED: Expected:\n"+string+"\n\nReceived:\n\n"+ast);
    }
}
