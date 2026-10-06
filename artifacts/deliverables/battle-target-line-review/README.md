# Battle guide line cleanup

Removed the obsolete center-anchored trajectory and its unused pulse styles. The existing guide from the selected hand card to the selected district remains.

Validation: 64 existing Battle UI tests passed; production build and entry bundle budgets passed. Browser inspection found zero legacy trajectories and exactly one visible selected-card guide in mobile, tablet portrait, tablet landscape, and widescreen views. Changing the selected card and district updates the new guide. Screenshots show the remaining guide in the local battle fixture.
