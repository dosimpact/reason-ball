
function $(el) {
    return {
        css: function (propertyName, value) {
            el.style[propertyName] = value;
            return this;
        }
    }
}