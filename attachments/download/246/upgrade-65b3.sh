#!/bin/bash

set -e

# Stop httpd-admin (if still running as admin) then remove the admin
# account, if it's present in passwd:
{ 
    service httpd-admin stop
    killall httpd-admin
    stop httpd-admin
    sleep 5
} || :

grep -q admin /etc/passwd && userdel admin

# Fix DB permissions:
chown -v root:adm /var/lib/nethserver/db/*

# Move admin key in configuration DB to root:
sed -i 's/^admin=/root=/' /var/lib/nethserver/db/configuration

# Clean up /etc/aliases:
sed -r -i '/^(# NethServer|root:|admin:)/ d' /etc/aliases

#
# Run the upgrade
#
yum clean all
yum update -y

set +e -x

# Refresh group members
if rpm -q nethserver-directory &>/dev/null; then
    /etc/e-smith/events/actions/group-modify-unix ev
    local_users=(`grep -F '=user|' /var/lib/nethserver/db/accounts | cut -d = -f 1`)
    lgroupmod -M "`echo ${local_users[*]} | tr ' ' ','`" locals
fi

if rpm -q nethserver-ibays &>/dev/null; then
    luserdel shared
    for IBAY in `grep -F '|OwningGroup|shared' /var/lib/nethserver/db/accounts  | cut -d = -f 1`; do
	/sbin/e-smith/db accounts setprop $IBAY OwningGroup locals
	chgrp -Rv locals /var/lib/nethserver/ibay/$IBAY 
    done
fi
