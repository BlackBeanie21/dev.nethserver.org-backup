=========
Use cases
=========
-----------------------------
 NethServer development docs
-----------------------------

.. contents:: 
.. sectnum::


Create user account
-------------------

:Id: _`UC1`
:Description: Creates a new system wide user identifier to access system services
:PrimaryActor: Operator
:Precondition: A person or an agent must be identified
:BasicFlow: 
  - Enter the user identifier, first and last name, company and address info
  - Optionally, specify one or more groups the user is member of.
  - Optionally, enable and configure services
:AlternateFlow:
  - If the identifier is used by another user, group or another kind
    of system object, validation fails

Delete user account
-------------------

:Id: _`UC2`
:Description: Removes an user identifier from the system
:PrimaryActor: Operator
:Precondition: A user account exists
:Postcondition: The user identifier and associated data are erased
:BasicFlow: 
  - Select the account to delete
  - SYSTEM asks for confirmation
  - Confirm


Modify user account
-------------------

:Id: _`UC3`
:Description: Changes group ownership and user-specific services configuration
:PrimaryActor: Operator
:PreCondition: A user account exists
:BasicFlow: 
  - Select the account to modify
  - Apply changes


Create group account
--------------------

:Id: _`UC4`
:Description: Create a system identifier to group user accounts together
:PrimaryActor: Operator
:BasicFlow: 
  - Enter the group identifier
  - Optionally enter description and specify initial group members
  - Optionally configure group related services
:AlternateFlow:
  - If the identifier is allocated to an existing group, user or
    another object a validation error occurs 


Modify group account
--------------------

:Id: _`UC5`
:Description: Modify an existing group properties
:PrimaryActor: Operator
:PreCondition: A group exists
:Trigger: A group is selected
:BasicFlow: 
  - Change description and group members
  - Configure group related services


Delete group account
--------------------

:Id: _`UC6`
:Description: Delete an existing group
:PrimaryActor: Operator
:PreCondition: A group exists
:BasicFlow: 
  - Select a group
  - SYSTEM ask for confirmation
  - Confirm
:PostCondition: The group identifier is removed



