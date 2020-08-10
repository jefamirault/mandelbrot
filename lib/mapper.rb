require_relative 'factory/ot_factory'
require 'fileutils'

class Mapper

end


def purge_folder(path)
  FileUtils.rm_f Dir.glob("#{path}/*")
end

options = {}

folder = 'renders/seahorse'
# purge_folder folder
seahorse = SeahorseFactory.new Renderer::RESOLUTIONS[17], directory: folder
seahorse.precisions = 21
seahorse.max_iterations = 8000
seahorse.run options
seahorse.map.write overwrite: true
