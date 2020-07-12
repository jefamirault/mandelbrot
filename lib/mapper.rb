require_relative 'factory/mandelbrot_factory'
require 'fileutils'

class Mapper

end


def purge_folder(path)
  FileUtils.rm_f Dir.glob("#{path}/*")
end


# folder = 'renders/cusp'
# resolutions = Renderer::RESOLUTIONS[17..17]
# resolutions = Renderer::RESOLUTIONS[8..8]
# cusp = CuspFactory.new resolutions, export_location: folder
# cusp.map = MandelbrotMap.new mapfile: "#{folder}/mapfile"
# cusp.map.load
# cusp.precisions = (45..48)
# cusp.center = [0.25505051596712,-0.00064763336314]
# cusp.max_iterations = 32000
#
# [0.75].each do |color_speed|
#   cusp.run color_speed: color_speed
# end
# cusp.map.write overwrite: true
factory_parameters = [
    {
        precision: 3,
        resolution: [34, 31],
        scale: 32
    },
    {
        precision: 4,
        resolution: [68, 63],
        scale: 16
    },
    {
        precision: 5,
        resolution: [136, 126],
        scale: 8 },
    {
        precision: 6,
        resolution: [270, 250],
        scale: 4
    },
    {
        precision: 7,
        resolution: [540, 480],
        scale: 2
    },
    {
        precision: 8,
        resolution: [1400, 1200],
        scale: 1
    },
    {
        precision: 9,
        resolution: [2800, 2400],
        scale: 1
    },
    {
        precision: 10,
        resolution: [5600, 4800]
    }
]

folder = 'renders/zoom_zero'
zoom_zero = ZoomZeroFactory.new [[64, 60]], export_location: folder
zoom_zero.map = MandelbrotMap.new mapfile: "#{folder}/mapfile_normalized"
zoom_zero.map.load

options = {color_speed: 25}
zoom_zero.max_iterations = 50

# fast
# factory_parameters[0..2].each do |params|
#   zoom_zero.scale = params[:scale]
#   zoom_zero.precisions = params[:precision]
#   zoom_zero.resolution = params[:resolution]
#   zoom_zero.run options
# end
#
# # medium
# factory_parameters[3..4].each do |params|
#   zoom_zero.scale = params[:scale]
#   zoom_zero.precisions = params[:precision]
#   zoom_zero.resolution = params[:resolution]
#   zoom_zero.run options
# end

# zoom_zero.map.write overwrite: true

# slow
options = { color_speed: 10 }
zoom_zero.max_iterations = 2000
factory_parameters[7..7].each do |params|
  zoom_zero.scale = params[:scale]
  zoom_zero.precisions = params[:precision]
  zoom_zero.resolution = params[:resolution]
  zoom_zero.run options
  zoom_zero.map.write overwrite: true
end
