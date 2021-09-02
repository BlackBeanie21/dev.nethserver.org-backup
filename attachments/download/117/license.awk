#!/bin/gawk -f

BEGIN {
    state = 0; 
    license = "/*\n";
    while((getline licenseLine < "license-notice.txt") > 0) {
        license = license " * " licenseLine "\n";
    }
    license = license " */"

}


#
# Only files starting with PHP open-tag are accepted.
# Skip any line between the open-tag and the namespace declaration.
# Then emit the LICENSE.txt as a comment-block.
#
(FLN == 0 && /^<\?php/), /^namespace / {
    if($0 ~ /^namespace/) {
        print "<?php\n" $0 "\n";
        print license
        state = 1;
        next;
    } else {
        next;
    }
}

#
# Proceed with normal outputting..
#
state == 1 {
    print;
}

END {
    if(state != 1) {
        exit 1;
    }
}