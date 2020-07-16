require_relative 'mandelbrot_factory'
require_relative '../composite_image'

class CompositeRender < MandelbrotFactory
#  defined by center, step, iterations, tile size, grid size
#  optional: scale, precision, color speed

  # def initialize(options = {})
  #   @center = options[:center] || [-0.75, 0]
  #   @max_iterations = options[:iterations] || 1000
  #   @precisions = options[:precision]
  #   @scale = options[:scale] || 1
  #   @resolution = options[:resolution]
  # end

  @skip_these = []

  @only_do_these = []

  
end


# Gigapixel Zoomed Out
#
# composite_center = [-0.75, 0]
# iterations = 4000
# scale = 1
# grid_size = 16
# symmetric = true
# # precision = 13
# width, height = 3250, 2850
# step = 0.00005


# Render Parameters

# Seahorse Valley

composite_center = [-0.7463, 0.1102]
iterations = 8000
scale = 1
precision = 16
grid_size = 8
width, height = 739, 416
step = 0.000000625


# define a job for each tile

x_start = composite_center[0] - (grid_size - 1) * width / 2 * step
y_start = composite_center[1] + (grid_size - 1) * height / 2 * step

tile_centers = []
(0...grid_size).each do |y|
  (0...grid_size).each do |x|
    tile_centers << [x_start + (x * width) * step, y_start - (y * height) * step]
  end
end

@composite_params = tile_centers.each_with_index.map do |center, index|
  {
      index: index,
      #  tile size
      resolution: [width, height],
      #  only used in filename
      precision: precision,
      # step overrides precision
      step: step,
      # scaling only makes sense for small resolution renders
      scale: scale,
      # center of the whole composite image
      center: center,
      # maximum iterations
      iterations: iterations
  }
end

@folder = 'renders/seahorse/composite_test'

# @skip_these = (0..7)
@skip_these = []

def skip?(index)
  @skip_these.each do |skip|
    return true if index == skip
  end
  false
end

# run jobs

@options = {
    prefix: 'seahorse'
}

def render_composite(params)
  queue = Queue.new
  params.each do |param|
    queue.push param
  end

  until queue.empty?
    job = queue.pop

    next if skip?(job[:index])

    @zoom_zero = ZoomZeroFactory.new [[64, 60]], export_location: @folder
    @zoom_zero.map = MandelbrotMap.new mapfile: "#{@folder}/map/composite_#{job[:index]}"
    @zoom_zero.map.load

    @zoom_zero.max_iterations = job[:iterations]
    @zoom_zero.precisions = job[:precision]
    @zoom_zero.override_step = job[:step]
    @zoom_zero.scale = job[:scale]
    @zoom_zero.resolution = job[:resolution]
    @zoom_zero.center = job[:center]
    @options[:label] = job[:index]
    @zoom_zero.run @options

    @zoom_zero.map.write overwrite: true
  end
end

render_composite @composite_params


#
c = CompositeImage.new
c.directory = 'renders/seahorse/composite_test'
c.label = 'seahorse'
c.tile_resolution = [739, 416]
c.grid_size = 8

c.combine
