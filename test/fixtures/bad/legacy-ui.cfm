<!--- Triggers: CFML-UI-001, CFML-UI-002, CFML-UI-003, CFML-UI-004, CFML-UI-005, CFML-UI-006, CFML-UI-007 --->
<cfgrid name="users" format="html"></cfgrid>
<cflayout type="tab"><cflayoutarea title="One">tab</cflayoutarea></cflayout>
<cfwindow name="help" title="Help">content</cfwindow>
<cfajaxproxy cfc="services.User" jsclassname="UserProxy">
<cftree name="nav"><cftreeitem value="root"></cftree>
<cfmenu name="main"><cfmenuitem display="Home"></cfmenu>
<cfform name="legacy" format="flash"><cfinput type="text" name="a"></cfform>
<cfinput type="datefield" name="dob">
<cfcalendar name="cal">
