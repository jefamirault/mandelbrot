class Point
  attr_accessor :location, :iterates_under_two, :iterations_checked

  def initialize(location, iterates_under_two, iterations_checked)
    @location = location # complex number
    @iterates_under_two = iterates_under_two
    @iterations_checked = iterations_checked
  end
end