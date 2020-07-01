require_relative 'mandelbrot_factory'
require 'fileutils'

class Mapper

end


def purge_folder(path)
  FileUtils.rm_f Dir.glob("#{path}/*")
end


folder = 'renders/cusp'

resolutions = Renderer::RESOLUTIONS[12..12]
cusp = CuspFactory.new resolutions, export_location: folder
cusp.map = MandelbrotMap.new mapfile: "#{folder}/mapfile.json"
cusp.map.load
cusp.precisions = (35..35)
cusp.center = [0.2550505158, -0.00064763438]
cusp.iterations = 16000

[0.5].each do |color_speed|
  cusp.run color_speed: color_speed
end

cusp.map.write overwrite: true

cusp.resolutions = Renderer::RESOLUTIONS[18..18]
cusp.precisions = (35..35)
cusp.run color_speed: 1

cusp.map.write overwrite: true


