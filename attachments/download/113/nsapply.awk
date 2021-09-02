#!/bin/gawk -f 

BEGIN {
    if(! Namespace ) {
        print "No namespace defined!" > "/dev/stderr"
        exit 1;
    }
    NamespacePattern = Namespace;
    gsub("\\\\", "\\\\", NamespacePattern);
    state = 0;
}

#
# Skip the first docblock:
#
state == 0 && /^<\?php/, /\*\// { 
    print; 
    next; 
}

state == 0 { 
    printf "\nnamespace %s;\n", Namespace; 
    state = 1; 
}

state == 1 { 
    gsub(NamespacePattern "\\\\", "");
    print;
}




