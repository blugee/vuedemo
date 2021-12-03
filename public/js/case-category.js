$(function(){
  $('#add-category').on('click', function(e){
    e.preventDefault();
    var $this = $(this);
    var $modal = $('#new-category-modal');
    var $form = $modal.find('form');
    var $select = $('#case_category');
    $.post('/cases/categories/new',
      $form.serialize(),
      function(data) {
        $select
         .prepend($("<option></option>")
         .attr("value",data.caseCategory._id)
         .text(data.caseCategory.name));
        $modal.modal('hide');
        $select
          .find('option[value="'+data.caseCategory._id+'"]')
          .prop('selected', true)
    });
  });
});