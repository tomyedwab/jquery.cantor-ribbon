/**
 * A horizontal ribbon that extends off the screen infinitely in both
 * directions and can be smoothly dragged via click & drag or just clicking
 * on the desired element.
 * 
 * The contents of the ribbon are created by a generator function which
 * takes and index (which is 0 at the origin and covers all integers) and
 * returns an element to draw at that index.
 *
 * The view is initially positioned such that element #0 is at the center
 * of the ribbon.
 */

// TODO: Handle window resize

(function( $ ) {

    var CantorRibbonView = function($el, generator, startIndex) {
        // Call the generator to create a subview and add it to the ribbon
        this.generateElement = function(index, adjacentElement) {
            // Generate the element and add it to the container element
            var $el = generator(index);
            if (!$el) {
                return false;
            }

            $el.addClass("ribbon-item")
               .css({
                   position: "absolute",
                   left: 0,
                   top: 0
               })
               .appendTo(this.$el);
                
            // Now we can measure the element
            var elWidth = $el.outerWidth();
            var elHeight = $el.outerHeight();

            // Expand to fit the tallest element, if necessary
            if (elHeight > this.maxHeight) {
                this.maxHeight = elHeight;
                this.$el.css("height", this.maxHeight + "px");
            }

            // Calculate the new anchor position
            var anchorPos = -elWidth / 2;
            if (adjacentElement) {
                if (adjacentElement.index < index) {
                    anchorPos = adjacentElement.anchorPos + adjacentElement.width;
                } else {
                    anchorPos = adjacentElement.anchorPos - elWidth;
                }
            }

            // Add to the subviews table
            this.subViews[index] = {
                index: index,
                view: $el,
                width: elWidth,
                anchorPos: anchorPos,
                centerPos: anchorPos + elWidth / 2
            }

            // Bind a click handler on the element
            // TODO: This gets annoying sometimes
            $el.on("click", $.proxy(function(event) {
                if (this.dragState && this.dragState.type == "interp") {
                    this.dragState = null;
                }
                this.goToIndex(index);
            }, this));

            // Position the element
            $el.css({ left: this.offset + anchorPos });

            // Update minIndex/maxIndex
            if (index < this.minIndex) {
                this.minIndex = index;
            }
            if (index > this.maxIndex) {
                this.maxIndex = index;
            }

            return true;
        };

        // Animate the positions of the subview elements
        this.updateViews = function() {
            var width = this.$el.width();

            while (this.offset + this.subViews[this.minIndex].anchorPos >= 0) {
                // Generate more views to the left
                if (!this.generateElement(this.minIndex - 1, this.subViews[this.minIndex])) {
                    break;
                }
            }
            while (this.offset + this.subViews[this.maxIndex].anchorPos +
                    this.subViews[this.maxIndex].width < width) {
                // Generate more views to the right
                if (!this.generateElement(this.maxIndex + 1, this.subViews[this.maxIndex])) {
                    break;
                }
            }

            $.each(this.subViews, $.proxy(function(idx, element) {
                if (this.offset + element.anchorPos + element.width < 0) {
                    // Fell off to the left
                    element.view.remove();
                    this.minIndex = Math.max(this.minIndex, idx * 1 + 1);
                    delete this.subViews[idx];
                    return;
                }
                if (this.offset + element.anchorPos > width) {
                    // Fell off to the right
                    element.view.remove();
                    this.maxIndex = Math.min(this.maxIndex, idx * 1 - 1);
                    delete this.subViews[idx];
                    return;
                }
                element.view.css({ left: this.offset + element.anchorPos });
                var selected = (this.offset + element.anchorPos <= width / 2) &&
                    (this.offset + element.anchorPos + element.width > width / 2);
                if (selected && this.selectedIndex != element.index) {
                    this.$el.trigger("ribbonSelected", element.index);
                }
                element.view.toggleClass("selected", selected);
            }, this));
        };

        // Navigate to a particular element on the ribbon
        this.goToIndex = function(index) {
            // Can't navigate while the user is dragging something
            if (this.dragState != null && this.dragState.type != "interp") {
                return;
            }
            if (index == this.selectedIndex) {
                return;
            }

            // Make sure the requested index is actually generated
            while (index < this.minIndex) {
                // Generate more views to the left
                if (!this.generateElement(this.minIndex - 1, this.subViews[this.minIndex])) {
                    break;
                }
            }
            while (index > this.maxIndex) {
                // Generate more views to the right
                if (!this.generateElement(this.maxIndex + 1, this.subViews[this.maxIndex])) {
                    break;
                }
            }

            if (!this.subViews[index]) {
                // We couldn't generate the requested index. Error?
                return;
            }

            // Update the selected index state
            this.selectedIndex = index;

            // Trigger an event that we've navigated
            this.$el.trigger("ribbonNavigated", index);

            var element = this.subViews[index];

            // Set the drag state to interpolation
            this.dragState = {
                type: 'interp',
                target: this.$el.width() / 2 - element.centerPos,
                targetIndex: index
            };

            var timer;
            timer = window.setInterval($.proxy(function() {
                // If some other drag event happened, abort this timer
                if (!this.dragState || this.dragState.type != "interp") {
                    window.clearInterval(timer);
                    return;
                };

                // Animate the offset
                this.offset = this.offset * 0.5 + this.dragState.target * 0.5;
                if (Math.abs(this.offset - this.dragState.target) < 3) {
                    // We're done; clear the timer and the drag state
                    var targetIndex = this.dragState.targetIndex;
                    this.offset = this.dragState.target;
                    window.clearInterval(timer);
                    this.dragState = null;
                }

                // Update subviews
                this.updateViews();
            }, this), 33);
        };

        // The ribbon element
        this.$el = $el;

        // Add the classes
        this.$el.addClass("cantor-ribbon");

        // Current scroll offset of the origin point
        this.offset = this.$el.width() / 2;

        // Minimum and maximum indices for generated elements
        this.minIndex = startIndex;
        this.maxIndex = startIndex;

        // Current height (grows to fit the tallest element ever encountered)
        this.maxHeight = 0;

        // Currently selected index
        this.selectedIndex = startIndex;

        // Cache of all our subviews by index
        this.subViews = {}

        // Drag state
        this.dragState = null;
        
        // Create the first element and add it to the ribbon
        this.generateElement(startIndex);

        // Populate the remaining views that are initially visible
        this.updateViews();

        // Bind event handlers for click & drag
        this.$el.on("mousedown", $.proxy(function(event) {
            this.dragState = {
                type: 'mouseDown',
                startX: event.clientX,
                lastX: event.clientX,
                lastTime: new Date(),
                velocity: 0,
                startOffset: this.offset
            };
            event.stopImmediatePropagation();
            event.preventDefault();
        }, this));

        $(document.body).on("mousemove", $.proxy(function(event) {
            if (this.dragState && this.dragState.type == "mouseDown") {
                // Update offset
                this.offset = (event.clientX - this.dragState.startX +
                    this.dragState.startOffset);

                // Update velocity
                var currentTime = new Date();
                var dt = currentTime - this.dragState.lastTime;
                this.dragState.velocity = this.dragState.velocity * 0.75 +
                    (event.clientX - this.dragState.lastX) / dt * 0.25;
                this.dragState.lastX = event.clientX;
                this.dragState.lastTime = currentTime;

                // Update subviews
                this.updateViews();

                event.stopImmediatePropagation();
                event.preventDefault();
            }
        }, this))
        .on("mouseup", $.proxy(function(event) {
            if (this.dragState && this.dragState.type == "mouseDown") {
                // Calculate the target offset given the position and velocity
                var finalOffset = this.offset + this.dragState.velocity * 100 - this.$el.width() / 2;

                // Find element whose center is nearest finalOffset
                // TODO: Handle end clamping better
                var bestElementIndex = this.selectedIndex;
                var bestElementDist = Math.abs(finalOffset + this.subViews[this.selectedIndex].centerPos);
                $.each(this.subViews, $.proxy(function(idx, element) {
                    var dist = Math.abs(finalOffset + element.centerPos);
                    if (dist < bestElementDist) {
                        bestElementIndex = element.index;
                        bestElementDist = dist;
                    }
                }, this));

                this.dragState = null;
                this.goToIndex(bestElementIndex);

                event.stopImmediatePropagation();
            }
        }, this));

        // We're all set! Fire an initial event for the initial navigation
        this.$el.trigger("ribbonNavigated", startIndex);
    };

    $.fn.cantorRibbon = function(optionsOrCommand, commandOptions) {
        // Don't bind multiple times
        if (this.data('cantorRibbonView')) {
            if (optionsOrCommand == "getSelectedIndex") {
                return this.data('cantorRibbonView').selectedIndex;
            }
            if (optionsOrCommand == "goToIndex") {
                this.data('cantorRibbonView').goToIndex(commandOptions);
            }
            return this;
        }
        return this.data('cantorRibbonView',
            new CantorRibbonView(
                this,
                optionsOrCommand.generator,
                optionsOrCommand.startIndex || 0));
    };

})( jQuery );
