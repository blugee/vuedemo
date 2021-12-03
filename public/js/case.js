$(function(){
  var currentPartIdx = $('.part-input').length;
  var newPartHTML = '<div class="form-group"><label for="part???" class="col-md-4 control-label">Part Name ???</label><div class="col-md-4"><input id="part???" name="parts[!!!]" type="text" placeholder="Part Name" class="form-control input-md" required></div></div>';
  $('#add-part').on('click', function(e) {
    e.preventDefault();
    var $this = $(this);
    $this
      .closest('.form-group')
      .before(newPartHTML
        .replace(/\!\!\!/g,currentPartIdx)
        .replace(/\?\?\?/g,++currentPartIdx)
      );
  });
});