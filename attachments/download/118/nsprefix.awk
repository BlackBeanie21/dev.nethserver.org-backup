#!/bin/gawk -f 

BEGIN {
    state = 0;
}

state == 0 {
    print;
}

/^namespace / {
    Namespace = substr($2, 0, length($2) - 1);
    NamespacePattern = Namespace;
    gsub("\\\\", "\\\\", NamespacePattern);
    print "NSPATTERN:" NamespacePattern > "/dev/stderr"
    state = 1; 
    next;
}

state == 1 {
    gsub(NamespacePattern "\\\\", "");
    print;
}
