require_relative 'mandelbrot_factory'

class HighResZoomZero < MandelbrotFactory

end


@options = {}

if ARGV[0] == 'fast'
  @options[:fast] = true
elsif ARGV[0] == 'slow'
  @options[:slow] = true
end

@factory_parameters = {
  3 => {
    resolution: [34, 31],
    scale: 32
  },
  4 => {
    resolution: [68, 63],
    scale: 16
  },
  5 => {
    resolution: [136, 126],
    scale: 8
  },
  6 => {
    resolution: [270, 250],
    scale: 4
  },
  7 => {
    resolution: [540, 480],
    scale: 2
  },
  8 => {
    resolution: [1400, 1200],
    scale: 1
  },
  9 => {
    resolution: [2800, 2400],
    scale: 1
  },
  10 => {
    resolution: [5600, 4800],
    scale: 1
  }
}

# folder = 'renders/high_res_zoomed_out'
# @zoom_zero = ZoomZeroFactory.new [[64, 60]], export_location: folder
# @zoom_zero.map = MandelbrotMap.new mapfile: "#{folder}/bottom_middle_left"
# @zoom_zero.map.load
#
# @zoom_zero.max_iterations = if @options[:fast]
#                       50
#                     elsif @options[:slow]
#                       500
#                     else
#                       100
#                     end

def render_batch(precisions)
  precisions.each do |precision|
    params = @factory_parameters[precision]
    @zoom_zero.precisions = precision
    @zoom_zero.scale = params[:scale]
    @zoom_zero.resolution = params[:resolution]
    @zoom_zero.run @options
  end
end



composite_center = [-0.75, 0]
iterations = 4000
scale = 1
grid_size = 16
precision = 13
# need to use 0.5*step from p=12
# width, height = 6500, 5700
width, height = 3250, 2850
# step = 0.0001
step = 0.00005
x_start = composite_center[0] - (grid_size - 1) * width / 2 * step
y_start = composite_center[1] + (grid_size - 1) * height / 2 * step

tile_centers = []
(0..7).each do |y|
  (0..15).each do |x|
    tile_centers << [x_start + (x * width) * step, y_start - (y * height) * step]
  end
end

@composite_params = tile_centers.map do |center|
  {
    resolution: [width, height],
    precision: precision,
    scale: scale,
    center: center,
    iterations: iterations
  }
end

@folder = 'renders/high_resolution_composite'

@mapfile_index = {
    0 => 0,
    1 => 0,
    8 => 0,
    9 => 0,
    2 => 1,
    3 => 1,
    10 => 1,
    11 => 1,
    4 => 2,
    5 => 2,
    12 => 2,
    13 => 2,
    6 => 3,
    7 => 3,
    14 => 3,
    15 => 3,
    16 => 4,
    17 => 4,
    24 => 4,
    25 => 4,
    18 => 5,
    19 => 5,
    26 => 5,
    27 => 5,
    20 => 6,
    21 => 6,
    28 => 6,
    29 => 6,
    22 => 7,
    23 => 7,
    30 => 7,
    31 => 7
}

def render_composite(params)
  params.each_with_index do |param, index|
    if index < 110
      next
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

precisions = if @options[:fast]
               3..5
             elsif @options[:slow]
               9..9
             else
               6..7
             end

# render_batch precisions
#
render_composite @composite_params
