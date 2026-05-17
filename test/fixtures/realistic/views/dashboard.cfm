<!--- Triggers: none --->
<cfscript> prc.heading = arrayLen( prc.items ) ? "Items" : "Empty"; </cfscript>
<h1><cfoutput>#encodeForHTML( prc.heading )#</cfoutput></h1>
