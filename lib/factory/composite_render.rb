require_relative 'mandelbrot_factory'

class CompositeRender < MandelbrotFactory
#  defined by center, step, iterations, tile size, grid size
#  optional: scale, precision, color speed

  def initialize(options = {})
    @center = options[:center] || [-0.75, 0]
    @max_iterations = options[:iterations] || 1000
    @precisions = options[:precision]
    @scale = options[:scale] || 1
    @resolution = options[:resolution]
  end

  @skip_these = []

  @only_do_these = []

  
end


@options = {}

composite_center = [-0.75, 0]
iterations = 4000
scale = 1
grid_size = 16
precision = 13
width, height = 3250, 2850
step = 0.00005

x_start = composite_center[0] - (grid_size - 1) * width / 2 * step
y_start = composite_center[1] + (grid_size - 1) * height / 2 * step

tile_centers = []
# 8 tiles tall
(0..7).each do |y|
  # 16 tiles wide
  (0..15).each do |x|
    tile_centers << [x_start + (x * width) * step, y_start - (y * height) * step]
  end
end

@composite_params = tile_centers.map do |center|
  {
    #  tile size
    resolution: [width, height],
    #  only used in filename
    precision: precision,
    # scaling only makes sense for small resolution renders
    scale: scale,
    # center of the whole composite image
    center: center,
    # maximum iterations
    iterations: iterations
  }
end

@folder = 'renders/high_resolution_composite'

already_complete = (0..117).to_a
@skip_these = already_complete + [
    118,
    121,
    122,
    123,
    124,
    125
]

def render_composite(params)
  params.each_with_index do |param, index|

    @skip_these.each do |skip|
      next if index == skip
    end

    @zoom_zero = ZoomZeroFactory.new [[64, 60]], export_location: @folder
    @zoom_zero.map = MandelbrotMap.new mapfile: "#{@folder}/composite_#{index}"
    @zoom_zero.map.load

    @zoom_zero.max_iterations = param[:iterations]
    @zoom_zero.precisions = param[:precision]
    @zoom_zero.scale = param[:scale]
    @zoom_zero.resolution = param[:resolution]
    @zoom_zero.center = param[:center]
    @zoom_zero.run @options

    @zoom_zero.map.write overwrite: true
  end
end

render_composite @composite_params
