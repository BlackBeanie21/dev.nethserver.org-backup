#!/usr/bin/python2.5

import pacparser


tests = [
    ("green1.1", "192.168.122.12", "http://192.168.122.100"),
    ("green1.2", "192.168.122.11", "http://www.centos.org"), 
    ("green1.3 (bypass)", "192.168.122.1", "http://www.centos.org"), 
    ("green2.1", "192.168.123.13", "http://www.nethserver.org"), 
    ("blue1", "192.168.150.7",  "http://www.centos.org"),

    ('dst bypass group from green', '192.168.122.12', 'http://mirror2.nethserver.org'),
    ('dst bypass group from blue', '192.168.150.8', 'http://mirror2.nethserver.org'),
    ('dst bypass cidr from green', '192.168.122.12', 'http://10.0.0.1'),
    ('dst bypass cidr from blue', '192.168.150.8', 'http://10.0.0.1'),
    ('dst bypass host from green', '192.168.122.12', 'http://packages.nethserver.org'),
    ('dst bypass host from blue', '192.168.150.8', 'http://packages.nethserver.org'),

    ('src bypass iprange from green', '192.168.122.91',  'http://www.nethserver.org'),
    ('src bypass iprange from blue', '192.168.150.91',  'http://www.nethserver.org'),
    ('src bypass host from green', '192.168.122.10',  'http://www.nethserver.org'),
    ('src bypass host from blue', '192.168.150.20',  'http://www.nethserver.org'),
    ('src bypass host-group from green', '192.168.122.3',  'http://www.nethserver.org'),
    ('src bypass host-group from blue', '192.168.150.33',  'http://www.nethserver.org'),
    ('src bypass cidr from green', '192.168.122.249',  'http://www.nethserver.org'),
    ('src bypass cidr from blue', '192.168.150.249',  'http://www.nethserver.org')
]

for t in tests:
    pacparser.init()
    pacparser.parse_pac("wpad.dat")
    pacparser.setmyip(t[1])
    proxy = pacparser.find_proxy(t[2])
    print "| %-34s | %-18s | %-34s | %s |" % (t[0], t[1], t[2], proxy)
    pacparser.cleanup()


