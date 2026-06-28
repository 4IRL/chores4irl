> **PREDECESSOR — superseded by `260627_future_feature_list.md`.** This was the original
> backlog. Four of its features have since merged to `main` (Edit Task, Confirm-delete,
> Swipe behaviors, Reduce bar height — F2/F4/F5/F6) and were removed from the current list;
> two new features were added there. See `plans/META-PLAN.md` for the live rollout. Kept for
> history only — do not plan from this file.

- [ ] Remove 'Details' and 'Long-term task' toggle from the Add Task form. Propagate the removal from the database and other associated schema related to these fields.
- [ ] Add Edit Task functionality. Open the task in a pre-populated modal similarly styled to the Add Task form. Accept user's changes to the task and reflect it when 'Save' button is selected.
- [ ] Include a type-as-you-search dropdown box for 'Room' on Add Task and Edit Task forms
- [ ] Require user confirmation of intent to delete a chore
- [ ] Add swipe behaviors
    - [ ] Swipe left to delete
	- [ ] Swipe right to edit
- [ ] Reduce height by spreading details across the bar width (instead of stacking all on left align)
	- [ ] Remove deletion 'x', obsoleted by swipe behavior
	- [ ] Remove 'Overdue' tags, obsoleted by updated bar visualization and fill calculation
	- [ ] Chore name on left
	- [ ] 'Last completed' and 'X days ago' calculation on far right
	- [ ] Remove reference to room from the progress bar itself
	- [ ] Center align 'frequency' e.g. "Every X days"
- [ ] Make 'Add Task' button deck transparent blur background, allowing the chores list visible slightly visible beneath for a more modern, fluid feel. The button will remain locked at the bottom and opaque as the chores list scrolls, but you should be able to see the chore bars on the sides of the button.
- [ ] Explore options by which local users can access a URL alias rather than an IP address and port. e.g. users connected to the local network can type 'C4I' in their browser, instead of 192.168.1.214:80
- [ ] Add a type-as-you-search text input field persistently at the top of the chores list, regardless of which room is highlighted. Chores are filtered out of visibility based on the substring entered by the user. This is meant to allow users to quickly find the desired chore to update once the list becomes unwieldly. 