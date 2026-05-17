<!--- good/report.cfm - Triggers: none --->
<cfscript>
    prc.users = getInstance( "CleanModel" ).listActive( rc.tenantId );
    prc.heading = arrayLen( prc.users ) ? "Active users" : "No users yet";
</cfscript>
<h1><cfoutput>#encodeForHTML( prc.heading )#</cfoutput></h1>
<ul>
<cfloop array="#prc.users#" index="u">
    <li><cfoutput>#encodeForHTML( u.email )#</cfoutput></li>
</cfloop>
</ul>
