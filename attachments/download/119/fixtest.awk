#!/bin/gawk -f

     
     function join(array, start, end, sep,    result, i)
     {
         if (sep == "")
            sep = " "
         else if (sep == SUBSEP) # magic value
            sep = ""
         result = array[start]
         for (i = start + 1; i <= end; i++)
             result = result sep array[i]
         return result
     }

BEGIN {
    state = 0;
    ClassName = "";
}



(FLN == 0 && /^<\?php/), /^class / {
    if(!ClassName) {
        split(FILENAME, ClassNameParts, /(\/|\.)/);
        ClassName = ClassNameParts[length(ClassNameParts) - 1];
        Namespace = join(ClassNameParts, 1, length(ClassNameParts) - 2, "\\");
        print "<?php\nnamespace " Namespace ";"
        state = 1;
    }

}

state == 1 && /^class / {
    gsub(/^class [^ ]+/, "class " ClassName);
    gsub(/PHPUnit/, "\\PHPUnit");
    gsub(/extends Test/, "extends \\Test");
    state = 2;
}


# skip PHP close tag
state == 2 && /\?>/ {
    next;
}

state == 2 {
    print;
}

