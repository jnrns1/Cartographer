<!--- Triggers: CFML-COMPAT-ADOBE-001, CFML-COMPAT-ADOBE-002, CFML-COMPAT-ADOBE-003, CFML-COMPAT-ADOBE-004, CFML-COMPAT-ADOBE-005 --->
<cfdocument format="pdf" permissions="AllowPrinting" ownerpassword="o">body</cfdocument>
<cfpdf action="processddx" ddxfile="t.ddx" name="out">
<cfpresentation title="Deck"><cfpresentationslide>Slide</cfpresentationslide></cfpresentation>
<cfexchangecalendar action="create" connection="c">
<cfspreadsheet action="read" src="data/in.xls" query="q">
