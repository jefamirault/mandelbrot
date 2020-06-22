class Grid
  attr_accessor :center_x, :center_y, :step, :width, :height, :points

  def initialize(x, y, precision, width, height)
    @center_x = x
    @center_y = y
    @step = 2 ** -precision
    @width = width
    @height = height
  end

  def include?(x, y)
    in_bounds = x >= x_min && x <= x_max && y >= y_min && y <= y_max
    on_step = x / step % 1 == 0 && y / step % 1 == 0

    in_bounds && on_step
  end

  def x_min
    if width.even?
      @center_x - (width / 2) * @step
    else
      @center_x - (width / 2).floor * @step
    end
  end

  def x_max
    if width.even?
      @center_x + (width / 2 - 1) * @step
    else
      @center_x + (width / 2).floor * @step
    end
  end

  def y_min
    if height.even?
      @center_y - height / 2 * @step
    else
      @center_y - (height / 2).floor * @step
    end
  end

  def y_max
    if height.even?
      @center_y + (height / 2 - 1) * @step
    else
      @center_y + (height / 2).floor * @step
    end
  end
end
